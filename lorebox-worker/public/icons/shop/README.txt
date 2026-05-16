■ 부적상점 상품 아이콘 (투명 PNG)

경로: lorebox-worker\public\icons\shop\
파일명: {iconId}.png  (예: seal_blue.png)

URL 예:
?theme=shop&item1=청색 결계부&price1=35000&iconId1=seal_blue

iconId1~4 / img1~4 — 파일명과 동일 (영문·숫자·_ 만)
없으면 홀로그램 기본 마크(符) 출력

■ 통합 몰 (theme=shop 하나) — 우상 배달 / 우하 상품
menu=burger,ramen,...  (32×32 PNG, 최대 24개, 가로 2줄)
food1~food24 / menuLabel=배달 주문
item1~4 · price · iconId — 우측 하단 ITEMS

예 (한 URL에 배달+상품 동시):
?theme=shop&shop=경계%20BASE&tag=생필·잡화
&menu=burger,ramen,fries,cola,bento,onigiri
&item1=청색결계부&price1=35000&iconId1=seal_blue

배포: npx wrangler deploy
