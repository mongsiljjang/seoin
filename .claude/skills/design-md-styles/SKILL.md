---
name: design-md-styles
description: Apply a well-known brand's visual design language — its exact colors, typography, spacing, radii, and component styles — to any UI, web page, app, dashboard, or component you are building or restyling. Use this whenever the user wants something to "look like <brand>", asks to restyle/redesign a UI in a brand's style, or asks for a concrete design direction or reference (e.g. Stripe, Linear, Coinbase, Apple, Notion, Airbnb, Spotify, Supabase, a Toss-like clean fintech look, etc.). Bundles 74 brand DESIGN.md specifications with real color/typography tokens.
license: MIT (bundled references © VoltAgent, see NOTICE.md)
---

# Design.md 스타일 적용 스킬

74개 유명 브랜드의 상세 디자인 명세(DESIGN.md)를 참고 자료로 갖고 있습니다.
각 파일에는 실제 색상 팔레트, 타이포그래피(폰트·크기·자간·굵기), 간격, 라운드값,
버튼·카드 등 컴포넌트 규칙이 토큰 형태로 정리돼 있습니다.

## 언제 쓰나
- 사용자가 "이거 **Stripe 스타일로** 해줘", "**Linear처럼** 깔끔하게", "**Coinbase 느낌**으로" 등 특정 브랜드 스타일을 요청할 때
- UI/웹/앱/컴포넌트를 특정 브랜드처럼 **다시 디자인**하고 싶을 때
- 구체적인 **디자인 방향/레퍼런스**를 원할 때

## 사용 방법 (반드시 따를 것)
1. 사용자가 말한 브랜드를 아래 목록에서 찾습니다(대소문자·표기 유연하게 매칭. 예: "linear" → `linear.app`, "mistral" → `mistral.ai`).
2. 해당 브랜드의 명세를 **읽습니다**: `references/design-md/<브랜드폴더>/DESIGN.md`
3. 그 파일의 **colors / typography / spacing / components** 토큰을 **그대로** 추출해, 지금 만들고 있는 UI에 충실히 적용합니다.
   - CSS 변수(:root)로 색상·폰트·간격을 옮기고, 버튼/카드/헤더 등 컴포넌트 규칙을 반영합니다.
   - 라이트/다크 지정이 있으면 지키고, 폰트가 유료/독점이면 가장 가까운 시스템·구글 폰트로 대체합니다.
4. 사용자가 브랜드를 지정하지 않았으면, 목적(예: 병원 앱=신뢰·청결)에 맞는 후보 2~4개를 추천하고 고르게 합니다.
5. 목록에 없는 브랜드면, 가장 비슷한 것을 제안하거나 사용자에게 확인합니다.

## 사용 가능한 브랜드 (폴더명)
airbnb, airtable, apple, binance, bmw, bmw-m, bugatti, cal, claude, clay, clickhouse, cohere, coinbase, composio, cursor, dell-1996, elevenlabs, expo, ferrari, figma, framer, hashicorp, hp, ibm, intercom, kraken, lamborghini, linear.app, lovable, mastercard, meta, minimax, mintlify, miro, mistral.ai, mongodb, nike, nintendo-2001, notion, nvidia, ollama, opencode.ai, pinterest, playstation, posthog, raycast, renault, replicate, resend, revolut, runwayml, sanity, sentry, shopify, slack, spacex, spotify, starbucks, stripe, supabase, superhuman, tesla, theverge, together.ai, uber, vercel, vodafone, voltagent, warp, webflow, wired, wise, x.ai, zapier


## 출처
번들된 DESIGN.md는 VoltAgent/awesome-design-md (MIT) 에서 가져왔습니다. NOTICE.md 참고.
브랜드 공식 자료가 아니라 "영감을 받은 재해석" 참고본입니다.
