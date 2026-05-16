괴이·강령체 도감 데이터 (dex.json)

■ 이 파일을 수정하면 로어북에 긴 설정을 넣지 않아도 됩니다.
■ 배포: npx wrangler deploy (JSON 변경 후 재배포)

■ AI 출력 형식 (ID만):
  ![](https://YOUR-WORKER.workers.dev/?theme=dex&id=BMA-0042)

■ dex.json 키 = id 파라미터 값
  각 항목: name, grade(재해|1|2|3|미확인), type, desc, report

■ 항목 추가: JSON에 "BMA-XXXX": { ... } 블록 추가 후 재배포

■ id 없이 name/text 직접 넣는 방식도 여전히 가능 (임시·미등록용)

■ grade: 재해/1/2/3 (위험등급, 재해는 1급 초과) | tag: 이형 (변이·뒤틀림 개체 전용)
■ 역사 사념체: BMA-0190 천화령~BMA-0200 장산범
■ 재해 예: BMA-0074 참화원귀 | BMA-0150 역혼령 | BMA-0193 역병령
