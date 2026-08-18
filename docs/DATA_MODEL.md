# MediOps 데이터 모델 (Cloud Firestore) v0.1

이 문서는 PRD v1.0 / DEV_PROMPTS의 원칙을 Firestore 구조로 옮긴 **설계 기준 문서**입니다.
아직 코드/보안규칙에는 적용하지 않았습니다(프로토타입 동작 보존). 구현 단계에서 이 문서를 기준으로 진행합니다.

## 0. 설계 원칙 (불변)
1. **멀티테넌트**: 모든 문서에 `hospitalId`. 병원 간 접근 차단은 보안규칙으로 강제.
2. **현재값과 거래이력 분리**: `currentQty`, 패키지 `remaining` 등은 **파생/캐시 값**이고, **진실의 원천은 append-only 거래 컬렉션**이다.
3. **삭제 금지**: 수정·삭제 대신 `status:'inactive'` 또는 **역거래(reversal)** 로 처리. 이력은 절대 파괴하지 않는다.
4. **금액은 정수(원)**: 소수/실수 금액 금지. 통화는 KRW 고정(파일럿).
5. **감사로그**: 권한/설정/보정 등 중요 변경은 `auditLogs`에 기록.
6. **서버 신뢰**: 클라이언트 계산만 신뢰하지 않는다. 잔량/금액 확정은 서버(규칙 + 향후 Cloud Functions)에서 검증.
7. **스냅샷 보존**: 과거 근태의 예정 근무시간, 구매 당시 단가 등은 시점 스냅샷으로 보존.

## 1. 컬렉션 개요 (top-level, 모두 hospitalId 보유)

| 컬렉션 | 역할 | 진실의 원천? |
|---|---|---|
| `hospitals` | 병원(테넌트) 마스터 | ✅ |
| `users` | 직원/권한 | ✅ |
| `workSchedules` | 직원별 요일 근무표 | ✅ |
| `attendance` | 출퇴근/근태(일자별) | ✅ |
| `attendanceEdits` | 근태 수정요청(승인 후 반영, 원본 보존) | ✅ |
| `leaveRequests` | 연차/반차 신청·승인 | ✅ |
| `inventoryItems` | 품목 마스터 + **캐시** 현재수량 | 캐시 |
| `inventoryTransactions` | **재고 입출고 append-only 원장** | ✅(원천) |
| `lots` | LOT/유통기한별 수량 | ✅ |
| `vendors` | 거래처 | ✅ |
| `purchaseOrders` | 발주/입고 | ✅ |
| `packages` | 선결제 패키지(계약 원장) | ✅ |
| `packageTransactions` | **패키지 금액/서비스 append-only 원장** | ✅(원천) |
| `serviceProducts` | 패키지 서비스(무상) 상품 정의 | ✅ |
| `exchanges` | 교환(반납/입고 동시, 1:N) | ✅ |
| `auditLogs` | 감사로그 | ✅ |
| `alerts` | 앱 내부 알림 | 파생 |

> 대안: `hospitals/{hospitalId}/...` 서브컬렉션 구조도 가능. 파일럿은 **top-level + hospitalId 필드 + 복합색인**으로 시작(규칙/색인이 단순, 다병원 쿼리 유연). 서브컬렉션 전환은 후속 검토.

## 2. 핵심 문서 스키마 (요지)

### hospitals/{hospitalId}
```
{ name, timezone:'Asia/Seoul', geo:{lat,lng,radiusM}, qrSecret,
  settings:{ lateGraceMin:5, breakStart:'13:00', breakEnd:'14:00',
             expiryAlertDays:[30,14,7,1], packageAlertDays:[30,14,7,1] },
  createdAt, status:'active' }
```

### users/{uid}
```
{ hospitalId, phone, pin, name, dept, position,
  role:'super_admin'|'admin'|'inventory_manager'|'employee',
  active:true|false, hireDate, annualLeaveTotal, createdAt }
```
- 로그인(무료 방식): 관리자가 직원 `phone`·`pin`·`role`을 선등록 → 직원은 **본인 전화번호 + 개인 PIN**으로 로그인(일치 시 해당 `users`로 로그인, 역할 부여). **SMS 발송 없음 → 완전 무료.** 퇴사자는 `active:false`(삭제 금지, 로그인 차단).
  - 데이터 접근 자격은 Firebase **Anonymous Auth**(무료)로 확보(`request.auth != null`), "누구인지/역할"은 **phone+PIN**으로 결정(클라이언트 소프트 인증 — 병원 내부 신뢰 전제).
  - phone은 정규화 저장(숫자만, 예: `01012345678`) — 중복 방지·조회 일관성. `pin`은 개인 비밀번호(4~8자리).
  - 더 강한 본인인증(통신사 SMS OTP)은 **유료**라 파일럿에서 제외, 필요 시 후속 옵션.

### inventoryItems/{itemId}  (현재값 = 캐시)
```
{ hospitalId, name, category, unit, minQty,
  currentQty,            // 캐시: inventoryTransactions 합계의 투영
  vendorId?, lastPrice?, // 최근 단가(스냅샷)
  status:'active'|'inactive', updatedAt }
```

### inventoryTransactions/{txId}  (append-only 원천)
```
{ hospitalId, itemId, lotId?,
  type:'in'|'out'|'adjust'|'reversal',
  quantity,                 // 부호 포함(입고 +, 사용/출고 -)
  beforeQuantity, afterQuantity,
  userId, at,               // 시각
  reference?,               // 발주/교환/사용맥락 id 등
  reversalOf?,              // 역거래 대상 txId (보정 시)
  note? }
```
- **규칙**: 생성만 허용. update/delete 금지. 보정은 `type:'reversal'` 신규 문서로.
- `currentQty`는 이 원장으로부터 재계산 가능해야 한다(정합성 검증 대상).

### lots/{lotId}
```
{ hospitalId, itemId, lotNo, qty, expiry, receivedAt, poId?, status }
```
- FEFO(유통기한 임박 우선) 안내는 `expiry` 오름차순.

### vendors/{vendorId}
```
{ hospitalId, name, manager, contact, site?, memo?, leadTimeDaysAvg?, status }
```

### purchaseOrders/{poId}
```
{ hospitalId, vendorId, status:'need'|'ordered'|'awaiting'|'received',
  lines:[{ itemId, qty, unitPriceAtOrder }],   // 구매 당시 단가 스냅샷
  orderedAt?, receivedAt?, createdBy, createdAt }
```

### packages/{packageId}  (계약 원장)
```
{ hospitalId, vendorId, name,
  paidAmount,        // 실제 입금액(정수 원)
  usableAmount,      // 사용가능액(입금액과 다를 수 있음)
  remaining,         // 캐시: packageTransactions 투영
  managerId, allowedItemIds:[...],   // 적용품목 제한
  expiry, status:'active'|'consumed'|'exchanged'|'renewed'|'negotiating'|'inactive',
  renewedFrom?, createdAt }
```

### packageTransactions/{ptxId}  (append-only 원천)
```
{ hospitalId, packageId,
  type:'use'|'service_use'|'rollover'|'renew'|'reversal',
  amount?,                 // 금액 차감/이월(정수)
  serviceProductId?, serviceQty?,  // 서비스 수량 차감/이월
  itemId?,                 // 교환/사용 연결 품목(허용품목만)
  userId, at, reference?, reversalOf?, note? }
```
- 재계약: 기존 `remaining` + 신규 `usableAmount` 합산은 **rollover 거래**로 기록, 화면엔 합산잔액, 내부엔 계약별 원장 보존.

### serviceProducts/{spId}
```
{ hospitalId, packageId, name, totalQty, remainingQty(캐시), status }
```

### exchanges/{exchangeId}
```
{ hospitalId, packageId?, at, userId,
  returned:[{ itemId, lotId?, qty }],   // 반납 차감
  received:[{ itemId, lotId?, qty }],   // 교환 입고 (1:N)
  status:'done'|'canceled', canceledOf? }  // 취소는 역거래
```

### attendance/{attId}
```
{ hospitalId, userId, date,
  scheduledStart, scheduledEnd,   // 시점 스냅샷
  inAt?, outAt?, method:'qr_gps',
  late?, earlyLeave?, overtimeMin?, workedMin?,
  missedCheckout?:bool, status }
```

### leaveRequests/{lrId}
```
{ hospitalId, userId, type:'annual'|'am_half'|'pm_half',
  startDate, endDate, days,
  status:'pending'|'approved'|'rejected', reason?, decidedBy?, createdAt }
```

### auditLogs/{logId}
```
{ hospitalId, actorId, action, targetType, targetId, before?, after?, at }
```

## 3. 보안규칙 설계 (계획 — 아직 미적용, 현재 deny-all 유지)
Auth(SMS OTP) 도입 전까지 `firestore.rules`는 **deny-all**을 유지한다. Auth 도입 후 아래 원칙으로 교체:
- 로그인 사용자의 `users/{uid}` 문서에서 `hospitalId`·`role`을 읽어 **커스텀 클레임**(또는 규칙 함수)으로 사용.
- 모든 읽기/쓰기: `resource.data.hospitalId == request.auth.token.hospitalId` 강제(병원 격리).
- `inventoryTransactions`·`packageTransactions`: **create만 허용, update/delete 금지**(append-only). `beforeQuantity/afterQuantity` 정합성은 Cloud Functions 검증 권장.
- `employee`: `inventoryItems` 읽기 + `inventoryTransactions`에 `type:'out'`(사용) create만. 입고/조정/발주/패키지/직원관리 **불가**.
- `inventory_manager`: 재고/거래처/발주/입고/패키지 운영.
- `admin`: 근태/연차/직원 + 위 재고 범위.
- `super_admin`: 권한 부여/회수, 전체 설정. `admin`이 `super_admin` 부여 **불가**.
- 권한/설정/보정 변경 → `auditLogs` 기록.

## 4. 향후 분석(파생) — 원장에서 계산
`inventoryTransactions`(사용=out)와 `purchaseOrders`/`lots`에서 파생:
- 일/주/월 평균 소모량, 예상 소진일(= 현재수량 ÷ 평균 일소모), 평균 주문 주기·수량, 거래처 평균 리드타임, 권장 주문 시점·수량.
> 현재값만 저장하면 위 분석이 불가능하므로 **거래이력 우선** 원칙이 필수.

## 5. 다음 구현 단계 제안 (DEV_PROMPTS 순서)
1. (본 문서) 데이터 모델 확정 ← 현재
2. 무료 로그인(전화번호+개인 PIN) + Anonymous Auth + `users` 부트스트랩(최초 관리자)
3. `firestore.rules` 교체(병원 격리 + 역할 + append-only)
4. 재고 기본(품목/트랜잭션/캐시 정합) → 직원 -1/-5 사용등록 배선
5. LOT/유통기한 → 거래처/발주 → 패키지/서비스/교환/재계약 → 알림 → 리포트 → 감사로그
