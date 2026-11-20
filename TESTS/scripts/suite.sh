#!/bin/bash
# usage: suite.sh <BASE_URL> <DB>
BASE=$1; DB=$2
LB=/tmp/lastbody.$$
sq(){ mysql -uroot -h127.0.0.1 -N -B -e "$1" "$DB" 2>&1 | tr '\t' ' ' | tr '\n' ';'; }
req(){ local label=$1 m=$2 p=$3 t=$4 b=$5
  local a=(-s -m 25 -o $LB -w '%{http_code}' -X "$m" "$BASE$p" -H 'Content-Type: application/json')
  [ -n "$t" ] && a+=(-H "Authorization: Bearer $t"); [ -n "$b" ] && a+=(-d "$b")
  local code; code=$(curl "${a[@]}")
  local body; body=$(head -c 230 $LB | tr '\n' ' ' | sed -E 's/eyJ[A-Za-z0-9._-]+/<JWT>/g; s/"createdAt":"[^"]*"/"createdAt":"<T>"/g')
  printf '%-40s | %s | %s\n' "$label" "$code" "$body"; }
jid(){ python3 -c "import json;print(json.load(open('$LB')).get('id',''))" 2>/dev/null; }
tokof(){ curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"password\":\"$2\"}" | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))" 2>/dev/null; }
cnt(){ local label=$1 p=$2; local code; code=$(curl -s -m 25 -o $LB -w '%{http_code}' "$BASE$p"); printf '%-40s | %s | count=%s\n' "$label" "$code" "$(python3 -c "import json;print(len(json.load(open('$LB'))))" 2>/dev/null)"; }

echo "##### 1. LECTURE PUBLIQUE"
cnt "GET /api/categories" /api/categories
cnt "GET /api/products" /api/products
req "GET /api/products/1" GET /api/products/1
cnt "GET /api/products/category/1" /api/products/category/1
cnt "GET /api/products/search?keyword=serum" "/api/products/search?keyword=serum"
req "GET /api/products/999999" GET /api/products/999999
req "GET /api/categories/1" GET /api/categories/1

echo "##### 2. AUTHENTIFICATION"
req "register nouveau client" POST /api/auth/register "" '{"nom":"Client Test","email":"client1@test.tn","password":"secret12"}'
req "register email déjà utilisé" POST /api/auth/register "" '{"nom":"X","email":"client1@test.tn","password":"secret12"}'
req "login mauvais mot de passe" POST /api/auth/login "" '{"email":"admin@miya.com","password":"mauvais"}'
req "login email inconnu" POST /api/auth/login "" '{"email":"nobody@x.tn","password":"x"}'
req "login admin" POST /api/auth/login "" '{"email":"admin@miya.com","password":"admin123"}'
req "login client" POST /api/auth/login "" '{"email":"client1@test.tn","password":"secret12"}'
ADMIN=$(tokof admin@miya.com admin123); CLIENT=$(tokof client1@test.tn secret12)
echo "users en base: $(sq 'SELECT email,role,LEFT(password,4) FROM users ORDER BY id')"

echo "##### 3. PRODUITS : CRUD"
echo "-- sans token"
req "POST produit (sans token)" POST /api/products "" '{"name":"Produit Test","description":"desc","price":12.5,"stock":10,"imageUrl":"","category":{"id":1}}'; P1=$(jid)
echo "   en base: $(sq "SELECT id,name,price,stock,category_id FROM products WHERE id=$P1")"
req "GET produit créé" GET /api/products/$P1
req "PUT produit (sans token)" PUT /api/products/$P1 "" '{"name":"Produit Modifie","description":"d2","price":15.75,"stock":4,"imageUrl":"","category":{"id":2}}'
echo "   en base: $(sq "SELECT id,name,price,stock,category_id FROM products WHERE id=$P1")"
req "DELETE produit (sans token)" DELETE /api/products/$P1
echo "   en base (doit être vide): $(sq "SELECT COUNT(*) FROM products WHERE id=$P1")"
req "GET produit supprimé" GET /api/products/$P1
echo "-- avec token CLIENT"
req "POST produit (CLIENT)" POST /api/products "$CLIENT" '{"name":"PTC","description":"d","price":1,"stock":1,"category":{"id":1}}'; P2=$(jid)
req "DELETE produit (CLIENT)" DELETE /api/products/$P2 "$CLIENT"
echo "-- avec token ADMIN"
req "POST produit (ADMIN)" POST /api/products "$ADMIN" '{"name":"PTA","description":"d","price":2,"stock":2,"category":{"id":1}}'; P3=$(jid)
req "PUT produit (ADMIN)" PUT /api/products/$P3 "$ADMIN" '{"name":"PTA2","description":"d","price":3,"stock":3,"category":{"id":1}}'
req "DELETE produit (ADMIN)" DELETE /api/products/$P3 "$ADMIN"

echo "##### 4. CATÉGORIES : CRUD"
req "POST catégorie (sans token)" POST /api/categories "" '{"name":"Cat Test","description":"dc"}'; C1=$(jid)
echo "   en base: $(sq "SELECT id,nom FROM categories WHERE id=$C1")"
req "PUT catégorie (sans token)" PUT /api/categories/$C1 "" '{"name":"Cat Modifiee","description":"dc2"}'
echo "   en base: $(sq "SELECT id,nom,description FROM categories WHERE id=$C1")"
req "DELETE catégorie (sans token)" DELETE /api/categories/$C1
echo "   en base (doit être vide): $(sq "SELECT COUNT(*) FROM categories WHERE id=$C1")"
req "POST catégorie (CLIENT)" POST /api/categories "$CLIENT" '{"name":"Cat CLIENT","description":"x"}'; C2=$(jid)
req "POST catégorie (ADMIN)" POST /api/categories "$ADMIN" '{"name":"Cat ADMIN","description":"x"}'; C3=$(jid)
req "DELETE catégorie (CLIENT)" DELETE /api/categories/$C2 "$CLIENT"
req "DELETE catégorie (ADMIN)" DELETE /api/categories/$C3 "$ADMIN"

echo "##### 5. COMMANDES"
STOCK0=$(sq "SELECT stock FROM products WHERE id=2")
req "GET /api/orders (sans token)" GET /api/orders
req "GET /api/orders (token invalide)" GET /api/orders "abc.def.ghi"
req "GET /api/orders (CLIENT)" GET /api/orders "$CLIENT"
req "GET /api/orders/stats (CLIENT)" GET /api/orders/stats "$CLIENT"
req "GET /api/orders (ADMIN)" GET /api/orders "$ADMIN"
req "GET /api/orders/stats (ADMIN)" GET /api/orders/stats "$ADMIN"
ORD='{"customerName":"Sarra Ben Ali","customerEmail":"sarra@mail.tn","customerPhone":"+216 20 111 222","shippingAddress":"Tunis","cartItems":[{"productId":2,"quantity":2},{"productId":6,"quantity":1}]}'
req "POST commande (sans token, invité)" POST /api/orders "" "$ORD"
req "POST commande (CLIENT)" POST /api/orders "$CLIENT" "$ORD"; O1=$(jid)
echo "   stock produit 2 avant=$STOCK0 après=$(sq 'SELECT stock FROM products WHERE id=2')"
echo "   commande en base: $(sq "SELECT id,customer_name,total_amount,status FROM orders WHERE id=$O1")"
echo "   lignes: $(sq "SELECT product_id,quantity,unit_price FROM order_items WHERE order_id=$O1 ORDER BY id")"
req "POST commande stock insuffisant" POST /api/orders "$CLIENT" '{"customerName":"A","customerEmail":"a@a.tn","customerPhone":"1","shippingAddress":"x","cartItems":[{"productId":2,"quantity":99999}]}'
req "POST commande champ manquant" POST /api/orders "$CLIENT" '{"customerName":"A"}'
req "GET commande par id (ADMIN)" GET /api/orders/$O1 "$ADMIN"
req "GET commandes d'un client (CLIENT)" GET /api/orders/customer/sarra@mail.tn "$CLIENT"
req "PUT statut (CLIENT)" PUT /api/orders/$O1/status "$CLIENT" '{"status":"SHIPPED"}'
req "PUT statut (ADMIN)" PUT /api/orders/$O1/status "$ADMIN" '{"status":"CONFIRMED"}'
echo "   statut en base: $(sq "SELECT status FROM orders WHERE id=$O1")"
req "PUT statut invalide (ADMIN)" PUT /api/orders/$O1/status "$ADMIN" '{"status":"NOPE"}'
req "DELETE commande (CLIENT)" DELETE /api/orders/$O1 "$CLIENT"
req "DELETE commande (ADMIN)" DELETE /api/orders/$O1 "$ADMIN"
echo "   commande supprimée en base: $(sq "SELECT COUNT(*) FROM orders WHERE id=$O1")"

echo "##### 6. CORS (origine http://localhost:4200)"
pre=$(curl -s -m 20 -D - -o /dev/null -X OPTIONS "$BASE/api/products/1" -H 'Origin: http://localhost:4200' -H 'Access-Control-Request-Method: PUT' -H 'Access-Control-Request-Headers: authorization,content-type')
echo "preflight PUT+Authorization : $(echo "$pre" | head -1 | tr -d '\r') | $(echo "$pre" | grep -i '^access-control-allow-origin' | tr -d '\r') | $(echo "$pre" | grep -i '^access-control-allow-methods' | tr -d '\r')"
g=$(curl -s -m 20 -D - -o /dev/null "$BASE/api/products" -H 'Origin: http://localhost:4200')
echo "GET avec Origin             : $(echo "$g" | head -1 | tr -d '\r') | $(echo "$g" | grep -i '^access-control-allow-origin' | tr -d '\r')"
g2=$(curl -s -m 20 -D - -o /dev/null "$BASE/api/orders" -H 'Origin: http://localhost:4200' -H "Authorization: Bearer $ADMIN")
echo "GET orders ADMIN avec Origin: $(echo "$g2" | head -1 | tr -d '\r') | $(echo "$g2" | grep -i '^access-control-allow-origin' | tr -d '\r')"

echo "##### 7. CAS LIMITES : suppressions liées"
req "POST catégorie de test (ADMIN)" POST /api/categories "$ADMIN" '{"name":"Cat Cascade","description":"x"}'; C4=$(jid)
req "POST produit dans cette catégorie (ADMIN)" POST /api/products "$ADMIN" "{\"name\":\"Prod Cascade\",\"description\":\"x\",\"price\":5,\"stock\":5,\"category\":{\"id\":$C4}}"; P4=$(jid)
req "DELETE catégorie contenant un produit" DELETE /api/categories/$C4 "$ADMIN"
echo "   produit $P4 en base après suppression de sa catégorie (1=conservé, 0=supprimé en cascade): $(sq "SELECT COUNT(*) FROM products WHERE id=$P4")"
req "POST commande avec produit 6 (CLIENT)" POST /api/orders "$CLIENT" '{"customerName":"B","customerEmail":"b@b.tn","customerPhone":"1","shippingAddress":"x","cartItems":[{"productId":6,"quantity":1}]}'; O2=$(jid)
req "DELETE produit déjà commandé (ADMIN)" DELETE /api/products/6 "$ADMIN"
echo "   produit 6 en base après (1=conservé): $(sq 'SELECT COUNT(*) FROM products WHERE id=6')"
echo "##### FIN"
rm -f $LB
