# IMPLANT_SPECS.md — 규격 숫자의 범위와, 그 범위를 어디에 쓰는가

앱이 규격 이름을 읽을 때 쓰는 **범위**를 어디서 가져왔는지 적는다.
`INSURANCE_RULES.md` 와 같은 목적이다 — 다음 세션이 같은 조사를 되풀이하지 않게.

- 조사일: **2026-08-22**
- 조사 방법: 웹 검색. **제조사 카탈로그 PDF 는 이 작업 환경의 게이트웨이가 막아
  직접 열지 못했다**(`osstemuk.com`·`spotimplant.com` 모두 `EGRESS_BLOCKED`).
  아래는 검색 결과와 이차 자료 기준이다.
- **이 문서는 임상 지침이 아니다.** 어떤 규격을 심을지는 원장이 정한다.

---

## 1. 이 범위를 무엇에 쓰는가 — 막는 데 쓰지 않는다

범위는 **입력을 막으려고** 두는 것이 아니다. 붙여 쓴 숫자에서
**물리적으로 불가능한 읽기를 지우는 데만** 쓴다.

사용자가 짚은 것이 출발점이다: **"임플란트에 30 길이는 없어."**

그래서 `3010` 은 이렇게 갈린다.

| 나눠 읽기 | 판정 |
|---|---|
| 3 / 010 → 두께 3, 길이 10 | 가능 |
| 30 / 10 → **두께 30mm** | **없다** — 지운다 |
| 301 / 0 → 길이 0 | 없다 — 지운다 |

남는 것이 하나뿐이라 `3.0×10` 으로 넣는다. **짐작한 것이 아니라 나머지가
불가능해서 남은 것이다.** 둘 이상 남으면 앱이 고르지 않고 물어본다.
범위를 벗어나도 **막지 않는다** — 모르는 기준으로 막으면 양치기가 된다.

---

## 2. 축 — 부품마다 숫자가 몇 개인가

**일반 치과는 픽스처를 두께와 길이로만 고른다**(사용자 확인, 2026-08-22).
잇몸높이(GH)는 힐링 쪽 축이다.

| 부품 | 첫째 축 | 둘째 축 |
|---|---|---|
| 픽스처 | 두께 | 길이 |
| 힐링캡 | 두께 | 잇몸높이(GH) |
| 어버트먼트 | 두께 | 높이 |
| 커버스크류 | 두께 | 높이 |

---

## 3. 앱이 쓰는 범위 (`SPEC_AXIS`)

실제 제품 범위보다 **넉넉하게** 잡았다. 좁게 잡으면 멀쩡한 규격을 못 읽는다.

| 부품 | 두께 | 둘째 축 |
|---|---|---|
| 픽스처 | 2 ~ 8 | 길이 4 ~ 20 |
| 힐링캡 | 2 ~ 10 | GH 0.5 ~ 12 |
| 어버트먼트 | 2 ~ 10 | 높이 0.5 ~ 20 |
| 커버스크류 | 1 ~ 10 | 높이 0.5 ~ 12 |

목록에 없는 부품(골이식재 등)은 두 축을 쓰지 않는다 — 이름을 그대로 받는다.

---

## 4. 근거 — 조사에서 확인한 것

### 픽스처 길이

- **가장 짧은 것 4mm** — Straumann Standard Plus Short 이 4mm 로 시판 중.
  통용되는 구분은 짧은 것 6~9mm · 중간 10~12mm · 긴 것 13~18mm.
  "extra-short" 는 6mm 이하.
- **긴 쪽은 16~18mm**. 일부 자료가 20mm 까지 적는다.
- 오스템 TS III 는 **6.0 · 7.0 · 8.5 · 10.0 · 11.5 · 13.0** 이 확인된다.

> 검색 결과 중 특허 문서 하나가 "8mm to 30mm" 라고 적고 있으나 **채택하지
> 않았다.** 특허 명세서의 청구 범위이지 판매 규격이 아니고, 사용자가 실무에서
> 30mm 는 없다고 확인했다. 카탈로그 쪽 숫자들과도 어긋난다.

### 픽스처 두께

- 자료마다 **2~6mm** 또는 **3~5mm** 를 흔한 범위로 적는다.
- 오스템 TS III 에 **5.5** 가 있고, 대구치용 광경은 6~7mm 대까지 간다.
- 좁은 쪽은 3.0~3.3mm 대.

### 힐링 잇몸높이(GH)

- Straumann BLX 는 **GH 0.75 ~ 3.5mm**.
- 다른 계열은 더 높은 것도 있어 위로 넉넉히 잡았다.
- 힐링 두께는 Straumann BLX 기준 **4.0 / 5.0 / 6.5 / 7.5**.

---

## 5. 확인하지 못한 것

- **오스템·덴티움 국내 카탈로그 원문을 못 읽었다.** 게이트웨이가 막는다.
  실제 취급 규격은 실장·영업사원이 답할 수 있다.
- 랩아날로그의 축이 몇 개인지 확인하지 못했다. 지금은 `SPEC_AXIS` 에 없어
  이름을 그대로 받는다. 두 축이면 한 줄 추가하면 된다.
- 어버트먼트·커버스크류의 둘째 축 이름(높이/커프/GH)이 병원마다 다를 수 있다.

---

## 6. 출처

- [Straumann — Standard Plus Short Implant (4mm)](https://www.straumann.com/en/dental-professionals/dental-implants/tissue-level-implant-line/standard-plus-short-implant.html)
- [Straumann BLX — Healing Abutment Quick Guide (GH·지름)](https://www.straumann.com/content/dam/media-center/straumann/en-us/documents/letter/NAMLIT-1489-BLX-Healing-Abutment-Quick-Guide.pdf)
- [Osstem TS III 제품 정보 (SpotImplant)](https://www.spotimplant.com/en/dental-implants/osstem-implant-company/ts-iii)
- [Osstem TS System 카탈로그 (PDF)](https://www.osstemuk.com/catalogs1/TS-CATALOG.pdf)
- [Short Dental Implants (≤6mm) — 임상 지침 정리](https://xgate.dental/short-dental-implants-indications/)
- [Extra-Short (4mm) vs Long (>8mm) 체계적 문헌고찰 — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC7998998/)
- [Dental Implant Size Chart (GDT)](https://gdt-implants.com/blogs/gdt-dental-implants-blog/dental-implant-size-chart-easy-understanding)
