const http=require('http'),fs=require('fs'),path=require('path'),{execSync}=require('child_process');
const {JSDOM,VirtualConsole}=require('jsdom');
const DB='ecommerce_db', API='http://localhost:8088/api', DIST='/tmp/jsd/dist2';
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html'};
const web=http.createServer((q,r)=>{let f=path.join(DIST,q.url.split('?')[0]);if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(DIST,'index.html');r.writeHead(200,{'Content-Type':mime[path.extname(f)]||'text/plain'});r.end(fs.readFileSync(f));}).listen(4200);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const sql=q=>execSync(`mysql --default-character-set=utf8mb4 -uroot -h127.0.0.1 -N -B -e "${q.replace(/"/g,'\\"')}" ${DB}`).toString().trim().replace(/\t/g,' | ').replace(/\n/g,' ; ');
let pass=0,fail=0; const out=(ok,msg,ev='')=>{ok?pass++:fail++;console.log((ok?'PASS ':'FAIL ')+msg+(ev?'  → '+ev:''));};
const login=async(e,p)=>(await (await fetch(API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:e,password:p})})).json());
async function open(url,ls={}){
  const errs=[];const vc=new VirtualConsole();vc.on('error',(...a)=>errs.push(a.map(x=>x&&x.message||x).join(' ').slice(0,160)));vc.on('jsdomError',e=>{const m=(e.detail&&e.detail.message)||e.message;if(!/font-awesome|Could not load link/.test(m))errs.push('jsdom:'+m.slice(0,160));});
  const dom=await JSDOM.fromURL('http://localhost:4200'+url,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:vc,
   beforeParse(w){for(const k in ls)w.localStorage.setItem(k,ls[k]);w.scrollTo=()=>{};w.Element.prototype.scrollIntoView=()=>{};w.confirm=()=>true;}});
  const w=dom.window,d=w.document;
  const H={w,d,errs,$:s=>d.querySelector(s),$$:s=>[...d.querySelectorAll(s)],T:s=>(d.querySelector(s)?.textContent||'').replace(/\s+/g,' ').trim(),
    path:()=>w.location.pathname,
    click:el=>{if(!el)throw new Error('élément introuvable');el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));},
    set:(sel,v)=>{const e=d.querySelector(sel);if(!e)throw new Error('champ introuvable '+sel);e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}));e.dispatchEvent(new w.Event('change',{bubbles:true}));},
    wait:async(fn,ms=6000)=>{const t=Date.now();while(Date.now()-t<ms){try{if(fn())return true;}catch(e){}await sleep(100);}return false;},
    close:()=>w.close()};
  await H.wait(()=>d.querySelector('app-root')?.children.length>0,6000); return H;
}
(async()=>{
 const ADM=await login('admin@miya.com','admin123');
 console.log('=== A. BOUTIQUE (lecture) — visiteur non connecté ===');
 let H=await open('/');
 await H.wait(()=>H.$$('.product-card').length>0);
 const nProd=sql('SELECT COUNT(*) FROM products'), nCat=sql('SELECT COUNT(*) FROM categories');
 out(H.$$('.product-card').length==nProd,'Liste des produits affichée = MySQL',`${H.$$('.product-card').length} cartes / ${nProd} lignes en base`);
 out(H.$$('#categoryFilters .cat-btn').length==+nCat+1,'Catégories affichées = MySQL (+ « All »)',`${H.$$('#categoryFilters .cat-btn').length} boutons / ${nCat} catégories`);
 out(/Login/.test(H.T('#nav-auth'))&&/Register/.test(H.T('#nav-auth')),'Barre de navigation : Login / Register visibles',H.T('#nav-auth'));
 H.click(H.$$('#categoryFilters .cat-btn')[1]); await H.wait(()=>/product/.test(H.T('#productCount'))&&H.$$('.product-card').length==+sql("SELECT COUNT(*) FROM products WHERE category_id=1"));
 out(H.$$('.product-card').length==+sql('SELECT COUNT(*) FROM products WHERE category_id=1'),'Filtre par catégorie',`${H.$$('.product-card').length} cartes / ${sql('SELECT COUNT(*) FROM products WHERE category_id=1')} en base`);
 H.set('#searchInput','serum'); H.click(H.$('.nav-search button')); await H.wait(()=>H.$$('.product-card').length==+sql("SELECT COUNT(*) FROM products WHERE LOWER(name) LIKE '%serum%' OR LOWER(description) LIKE '%serum%'"),4000);
 out(H.$$('.product-card').length>0,'Recherche « serum »',`${H.$$('.product-card').length} résultat(s)`);
 H.click(H.$$('#categoryFilters .cat-btn')[0]); await H.wait(()=>H.$$('.product-card').length==+nProd);
 H.click(H.$$('.product-card')[0]); await H.wait(()=>H.T('#modalBody').length>5);
 out(H.$('#productModal').classList.contains('open')&&H.T('.modal-product-name')==sql('SELECT name FROM products ORDER BY id LIMIT 1'),'Consulter un produit (fenêtre de détail = MySQL)',H.T('.modal-product-name'));
 out(H.errs.length==0,'Aucune erreur console / CORS pendant la lecture',H.errs.join(' ; ')||'0 erreur'); H.close();

 console.log('\n=== B. COMMANDE par un visiteur non connecté (invité) ===');
 H=await open('/'); await H.wait(()=>H.$$('.add-to-cart-btn').length>2);
 const s0=+sql('SELECT stock FROM products WHERE id=2');
 H.click(H.$$('.add-to-cart-btn').find((b,i)=>H.$$('.product-card')[i].querySelector('.product-name').textContent.includes('COSRX')));
 H.click(H.$('.cart-btn')); await sleep(300); H.click(H.$('.btn-checkout')); await sleep(300);
 H.set('#custName','Sarra Ben Ali'); H.set('#custEmail','sarra@mail.tn'); H.set('#custPhone','+216 20 111 222'); H.set('#custAddress','Tunis'); H.click(H.$('.btn-confirm'));
 await H.wait(()=>/confirmed/i.test(H.T('#toast')),5000);
 out(/Order #\d+ confirmed/.test(H.T('#toast')),'Invité : commande acceptée',H.T('#toast'));
 out(sql("SELECT COUNT(*) FROM orders WHERE customer_email='sarra@mail.tn'")=='1','Commande enregistrée dans MySQL',sql("SELECT id,customer_name,total_amount,status FROM orders WHERE customer_email='sarra@mail.tn'"));
 out(sql('SELECT stock FROM products WHERE id=2')==String(s0-1),'Stock décrémenté en base',`${s0} → ${sql('SELECT stock FROM products WHERE id=2')}`);
 out(H.errs.length==0,'Aucune erreur console',H.errs.join(' ; ')||'0 erreur'); H.close();

 console.log('\n=== C. INSCRIPTION puis CONNEXION CLIENT (via l\'interface) ===');
 H=await open('/register'); H.set('#nom','Client E2E'); H.set('#email','e2e@test.tn'); H.set('#password','secret12'); H.set('#confirm','secret12'); H.click(H.$$('button').find(b=>/Create My Account/.test(b.textContent)));
 await H.wait(()=>/successfully/i.test(H.T('#successMsg')),5000);
 out(/successfully/i.test(H.T('#successMsg')),'Register : message de succès',H.T('#successMsg'));
 out(sql("SELECT role FROM users WHERE email='e2e@test.tn'")=='CLIENT'&&sql("SELECT LEFT(password,4) FROM users WHERE email='e2e@test.tn'")=='$2a$','Utilisateur en base : rôle CLIENT, mot de passe haché BCrypt',sql("SELECT email,role,LEFT(password,7) FROM users WHERE email='e2e@test.tn'"));
 await H.wait(()=>H.path()=='/',4000); out(H.path()=='/'&&!!H.w.localStorage.getItem('token'),'Après register : redirigé vers la boutique avec JWT stocké',`${H.path()} token=${(H.w.localStorage.getItem('token')||'').slice(0,12)}…`); H.close();
 H=await open('/login'); H.set('#email','e2e@test.tn'); H.set('#password','mauvais'); H.click(H.$('button')); await H.wait(()=>H.T('#errorMsg').length>0);
 out(/incorrect/.test(H.T('#errorMsg')),'Login mauvais mot de passe : message d\'erreur',H.T('#errorMsg'));
 H.set('#password','secret12'); H.click(H.$('button')); await H.wait(()=>H.path()=='/',5000);
 out(H.path()=='/'&&H.w.localStorage.getItem('role')=='CLIENT','Login CLIENT : redirigé vers la boutique, rôle CLIENT',`${H.path()} role=${H.w.localStorage.getItem('role')}`);
 await H.wait(()=>/Logout/.test(H.T('#nav-auth')),3000); out(/Client E2E/.test(H.T('#nav-auth'))&&!/Admin/.test(H.T('#nav-auth'))&&/Logout/.test(H.T('#nav-auth')),'Barre de navigation CLIENT : nom + Logout, pas de lien Admin',H.T('#nav-auth'));
 H.click(H.$$('#nav-auth button')[0]); await H.wait(()=>/Login/.test(H.T('#nav-auth')),3000);
 out(!H.w.localStorage.getItem('token')&&/Login/.test(H.T('#nav-auth')),'Logout : session effacée, Login/Register de retour'); H.close();

 console.log('\n=== D. RÔLES : un CLIENT ne peut pas utiliser l\'administration ===');
 const CL=await login('e2e@test.tn','secret12');
 H=await open('/admin',{token:CL.token,role:CL.role,nom:CL.nom,email:CL.email}); await sleep(1500);
 out(H.path()=='/','CLIENT → /admin : redirigé vers la boutique (guard)',H.path()); H.close();
 H=await open('/admin'); await sleep(1200); out(H.path()=='/login','Sans token → /admin : redirigé vers /login',H.path()); H.close();
 const r1=await fetch(API+'/products',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+CL.token},body:JSON.stringify({name:'X',price:1,stock:1})});
 out(r1.status==403,'API : CLIENT ne peut pas créer de produit',`HTTP ${r1.status}`);
 const r2=await fetch(API+'/orders',{headers:{Authorization:'Bearer '+CL.token}}); out(r2.status==403,'API : CLIENT ne peut pas lister toutes les commandes',`HTTP ${r2.status}`);

 console.log('\n=== E. ADMINISTRATION (ADMIN connecté via l\'interface) ===');
 H=await open('/login'); H.set('#email','admin@miya.com'); H.set('#password','admin123'); H.click(H.$('button')); await H.wait(()=>H.path()=='/admin',6000);
 out(H.path()=='/admin'&&H.w.localStorage.getItem('role')=='ADMIN','Login ADMIN : redirigé vers /admin',`${H.path()} role=${H.w.localStorage.getItem('role')}`);
 await H.wait(()=>/^\d+$/.test(H.T('#statProducts')),5000);
 out(H.T('#statProducts')==sql('SELECT COUNT(*) FROM products')&&H.T('#statOrders')==sql('SELECT COUNT(*) FROM orders')&&H.T('#statCategories')==sql('SELECT COUNT(*) FROM categories'),'Dashboard = MySQL (produits / commandes / catégories)',`${H.T('#statProducts')}/${H.T('#statOrders')}/${H.T('#statCategories')} — revenu ${H.T('#statRevenue')}`);
 const menu=()=>H.$$('.menu-item');
 // --- PRODUITS
 H.click(menu()[1]); await H.wait(()=>H.$$('#productsTableBody tr').length==+sql('SELECT COUNT(*) FROM products'));
 out(H.$$('#productsTableBody tr').length==+sql('SELECT COUNT(*) FROM products'),'READ  — liste admin des produits = MySQL',`${H.$$('#productsTableBody tr').length} lignes`);
 H.click(H.$('#section-products .btn-add')); await H.wait(()=>H.$('#productFormModal').classList.contains('open')&&H.$$('#productCategory option').length>1);
 H.set('#productName','Produit E2E'); H.set('#productCategory','2'); H.set('#productPrice','12.5'); H.set('#productStock','7'); H.set('#productDescription','créé depuis Angular'); H.set('#productImage','https://example.com/p.jpg');
 await sleep(200); H.click(H.$('#productFormModal .btn-save')); await H.wait(()=>sql("SELECT COUNT(*) FROM products WHERE name='Produit E2E'")=='1',5000);
 out(sql("SELECT COUNT(*) FROM products WHERE name='Produit E2E'")=='1','CREATE — produit enregistré dans MySQL',sql("SELECT id,name,price,stock,category_id,description,image_url FROM products WHERE name='Produit E2E'"));
 await H.wait(()=>H.$$('#productsTableBody tr').some(r=>/Produit E2E/.test(r.textContent)),4000); out(H.$$('#productsTableBody tr').some(r=>/Produit E2E/.test(r.textContent)),'CREATE — le produit apparaît dans le tableau');
 const pid=sql("SELECT id FROM products WHERE name='Produit E2E'");
 let row=H.$$('#productsTableBody tr').find(r=>/Produit E2E/.test(r.textContent)); H.click(row.querySelector('.btn-edit'));
 await H.wait(()=>H.$('#productName').value=='Produit E2E'&&H.$('#productFormModal').classList.contains('open'));
 out(H.$('#productName').value=='Produit E2E'&&H.$('#productPrice').value=='12.5'&&H.$('#productCategory').value=='2','Formulaire d\'édition pré-rempli',`${H.$('#productName').value} / ${H.$('#productPrice').value} / cat ${H.$('#productCategory').value}`);
 H.set('#productName','Produit E2E modifié'); H.set('#productPrice','19.9'); H.set('#productStock','3'); await sleep(200); H.click(H.$('#productFormModal .btn-save'));
 await H.wait(()=>sql(`SELECT name FROM products WHERE id=${pid}`)=='Produit E2E modifié',5000);
 out(sql(`SELECT CONCAT(name,'|',price,'|',stock) FROM products WHERE id=${pid}`)=='Produit E2E modifié|19.90|3','UPDATE — modifications enregistrées dans MySQL',sql(`SELECT id,name,price,stock,category_id FROM products WHERE id=${pid}`));
 await H.wait(()=>H.$$('#productsTableBody tr').some(r=>/Produit E2E modifié/.test(r.textContent)),4000);
 row=H.$$('#productsTableBody tr').find(r=>/Produit E2E modifié/.test(r.textContent)); out(!!row,'UPDATE — tableau rafraîchi');
 H.click(row.querySelector('.btn-delete')); await H.wait(()=>sql(`SELECT COUNT(*) FROM products WHERE id=${pid}`)=='0',5000);
 out(sql(`SELECT COUNT(*) FROM products WHERE id=${pid}`)=='0','DELETE — produit supprimé de MySQL',`lignes restantes pour id ${pid}: ${sql(`SELECT COUNT(*) FROM products WHERE id=${pid}`)}`);
 await H.wait(()=>!H.$$('#productsTableBody tr').some(r=>/Produit E2E modifié/.test(r.textContent)),4000); out(!H.$$('#productsTableBody tr').some(r=>/Produit E2E modifié/.test(r.textContent)),'DELETE — le produit disparaît de l\'interface');
 // --- CATEGORIES
 H.click(menu()[2]); await H.wait(()=>H.$$('#categoriesTableBody tr').length==+sql('SELECT COUNT(*) FROM categories'));
 out(H.$$('#categoriesTableBody tr').length==+sql('SELECT COUNT(*) FROM categories'),'Catégories : liste = MySQL',`${H.$$('#categoriesTableBody tr').length} lignes`);
 H.click(H.$('#section-categories .btn-add')); await H.wait(()=>H.$('#categoryFormModal').classList.contains('open')); H.set('#categoryName','Cat E2E'); H.set('#categoryDescription','desc e2e'); await sleep(200); H.click(H.$('#categoryFormModal .btn-save'));
 await H.wait(()=>sql("SELECT COUNT(*) FROM categories WHERE nom='Cat E2E'")=='1',5000); out(sql("SELECT COUNT(*) FROM categories WHERE nom='Cat E2E'")=='1','Catégorie CREATE — enregistrée dans MySQL',sql("SELECT id,nom,description FROM categories WHERE nom='Cat E2E'"));
 const cid=sql("SELECT id FROM categories WHERE nom='Cat E2E'"); await H.wait(()=>H.$$('#categoriesTableBody tr').some(r=>/Cat E2E/.test(r.textContent)));
 row=H.$$('#categoriesTableBody tr').find(r=>/Cat E2E/.test(r.textContent)); H.click(row.querySelector('.btn-edit')); await H.wait(()=>H.T('#categoryModalTitle')=='Edit Category'&&H.$('#categoryName').value=='Cat E2E'); H.set('#categoryName','Cat E2E modifiée'); await sleep(200); H.click(H.$('#categoryFormModal .btn-save'));
 await H.wait(()=>sql(`SELECT nom FROM categories WHERE id=${cid}`)=='Cat E2E modifiée',5000); out(sql(`SELECT nom FROM categories WHERE id=${cid}`)=='Cat E2E modifiée','Catégorie UPDATE — enregistrée dans MySQL',sql(`SELECT id,nom FROM categories WHERE id=${cid}`));
 await H.wait(()=>H.$$('#categoriesTableBody tr').some(r=>/Cat E2E modifiée/.test(r.textContent))); row=H.$$('#categoriesTableBody tr').find(r=>/Cat E2E modifiée/.test(r.textContent)); H.click(row.querySelector('.btn-delete'));
 await H.wait(()=>sql(`SELECT COUNT(*) FROM categories WHERE id=${cid}`)=='0',5000); out(sql(`SELECT COUNT(*) FROM categories WHERE id=${cid}`)=='0','Catégorie DELETE — supprimée de MySQL');
 // --- COMMANDES
 H.click(menu()[3]); await H.wait(()=>H.$$('#ordersTableBody tr').length>=1&&/Sarra/.test(H.T('#ordersTableBody')));
 out(/Sarra Ben Ali/.test(H.T('#ordersTableBody')),'Commandes : la commande de l\'invité est listée',H.$$('#ordersTableBody tr').length+' ligne(s)');
 const sel=H.$('#ordersTableBody .status-select'); sel.value='SHIPPED'; sel.dispatchEvent(new H.w.Event('change',{bubbles:true}));
 await H.wait(()=>sql("SELECT status FROM orders WHERE customer_email='sarra@mail.tn'")=='SHIPPED',5000); out(sql("SELECT status FROM orders WHERE customer_email='sarra@mail.tn'")=='SHIPPED','Commande : changement de statut enregistré dans MySQL','PENDING → SHIPPED');
 H.click(H.$('#ordersTableBody .btn-delete')); await H.wait(()=>sql("SELECT COUNT(*) FROM orders WHERE customer_email='sarra@mail.tn'")=='0',5000); out(sql("SELECT COUNT(*) FROM orders WHERE customer_email='sarra@mail.tn'")=='0','Commande : suppression enregistrée dans MySQL');
 out(H.errs.length==0,'Aucune erreur console / CORS pendant toute la session admin',H.errs.join(' ; ')||'0 erreur'); H.close();

 console.log('\n=== F. SESSION EXPIRÉE / JWT INVALIDE ===');
 H=await open('/admin',{token:'jeton.invalide.xyz',role:'ADMIN',nom:'Admin',email:'admin@miya.com'}); await H.wait(()=>H.path()=='/login',6000);
 out(H.path()=='/login'&&!H.w.localStorage.getItem('token'),'JWT invalide sur /admin : session effacée et retour vers /login',`${H.path()} token=${H.w.localStorage.getItem('token')}`); H.close();
 console.log(`\nRÉSULTAT : ${pass} PASS, ${fail} FAIL`);
 web.close(); process.exit(fail?1:0);
})().catch(e=>{console.log('ERREUR SCRIPT:',e.stack||e);process.exit(2);});
