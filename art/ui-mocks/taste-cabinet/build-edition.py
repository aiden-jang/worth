from pathlib import Path
import runpy
ref=runpy.run_path(str(Path(__file__).with_name('build-reference.py')))
root=Path(__file__).parent/'edition';root.mkdir(exist_ok=True)
head=ref['head'].replace('../../../','../../../../')+'<link rel="stylesheet" href="../../../../src/details.css"><link rel="stylesheet" href="../../../../src/cabinet-edition.css">'
def save(name,body):
 body=body.replace('../../../public/','../../../../public/')
 (root/f'{name}.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Worth · '+name+'</title>'+head+'<body>'+body+'</body></html>')
def shell(s,active='Archive'):return ref['shell'](s,active)
def artwork(name):
 if name in ['Drinks','Movies','Places','Cars']:
  return f'<div class="collection-artwork"><img src="../../../public/art/starter-covers/{name.lower()}-v2.svg" alt=""></div>'
 return f'<div class="collection-artwork cabinet-monogram" data-tone="sage"><span class="monogram-sheet"></span><span class="monogram-letter">{name[0]}</span><span class="monogram-orbit"></span></div>'
blank='''<svg class="collection-empty-illustration" viewBox="0 0 180 156" fill="none" aria-hidden="true"><g stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="38" y="23" width="93" height="118" rx="12" transform="rotate(-12 38 23)" fill="var(--blank-back, #292a23)"/><rect x="43" y="13" width="93" height="118" rx="12" transform="rotate(7 43 13)" fill="#eae5d5" stroke="#cbc9b8"/><path d="m63 44 50 6m-52 11 32 4" stroke="#aaa99b"/><path d="m65 88 22 3" stroke="#67695b"/></g><path d="M145 32v16m-8-8h16" stroke="#e8dc9d" stroke-width="1.5" stroke-linecap="round"/></svg>'''
# Current populated archive retains its hierarchy, with authored category artwork.
home=ref['home']
for n in ['drinks','movies','places']:home=home.replace(f'{n}-v1.webp',f'{n}-v2.svg')
save('archive',shell(home))
# A sparse archive demonstrates a custom name without an uploaded photo.
a=home.index('<ol class="cabinet-shelves">');z=home.index('</ol></section>',a)
shelf='<ol class="cabinet-shelves"><li><a class="cabinet-folder"><div class="cabinet-folder-picture">'+artwork('Books')+'<span class="cabinet-folder-number">01</span></div><div class="cabinet-folder-copy"><span><strong>Books</strong><small>1 item</small></span><span>↗</span></div></a></li>'
sparse=home[:a]+shelf+home[z:]
a=sparse.index('<div class="cabinet-home-lower">');sparse=sparse[:a]+'''<div class="cabinet-home-lower"><section class="cabinet-recent"><header class="cabinet-section-head"><h2>Recently filed</h2></header><ol class="activity-rail"><li><time>JUST NOW</time><a><strong>A book to remember</strong><span>Books</span></a></li></ol></section><aside><a class="cabinet-pick"><p class="overline">YOUR RANKING</p><div class="cabinet-pick-rank"><span>—</span></div><h3>Unranked. Unbothered.</h3><p>Pick an item when something stands out.</p></a></aside></div></main>'''
save('archive-sparse',shell(sparse))
empty='''<main class="archive-page"><section class="cabinet-first-use page-width"><div class="cabinet-first-use-intro"><p class="overline">YOUR TASTE, ON RECORD</p><h1>A clean slate. Suspicious.</h1><p>Keep the things you try in a collection. A name is enough to get started.</p><div class="empty-archive-actions"><a class="button button-accent">Start a collection →</a><a class="button button-outline">Start an activity →</a></div></div><div class="cabinet-first-look" aria-hidden="true"><p class="overline">ROOM FOR OPINIONS</p><span>00</span>'''+ref['face'](arms=True)+'''<div class="cabinet-blank-rules"></div></div><div class="cabinet-first-use-footer"><p>Make room for your taste.</p><span>Keep a name</span><span>Make a call, if you want</span><span>Find it again</span></div></section></main>'''
save('archive-empty',shell(empty))
save('collection',shell(ref['collection'],'Collections'))
# Same collection header/capture with a purpose-built empty composition.
col=ref['collection'];i=col.index('<div class="collection-index-layout">');emptycol=col[:i]+'<div class="collection-empty-composition">'+blank+'<div><h2>Nothing to judge. Yet.</h2><p>Add the first thing you tried. A name will do.</p><button class="button button-outline">Add a name →</button></div></div></div></div></section></main>'
emptycol=emptycol.replace('8 items · 5 ranked','0 items').replace('cabinet-collection-body','cabinet-collection-body cabinet-collection-empty')
save('collection-empty',shell(emptycol,'Collections'))
create='''<main class="light-page lists-page page-width"><div class="page-head"><div><p class="overline">YOUR ARCHIVE</p><h1>Collections</h1><p>The good, the meh, and the “not again.”</p></div></div><section class="create-panel cabinet-create"><div class="panel-title"><div><p class="overline">NEW COLLECTION</p><h2>What are you collecting?</h2></div><button class="icon-button" aria-label="Close">×</button></div><div class="cabinet-create-layout"><form class="create-form"><label>Name<input value="Books" placeholder="Whiskey, movies, runs…"></label><div class="cabinet-name-ideas"><span>A few ideas</span><button type="button">Drinks</button><button type="button">Movies</button><button type="button">Books</button></div><details class="create-extras"><summary>Description &amp; cover <span class="optional">optional</span></summary></details><button class="button button-accent">Create collection →</button></form><aside class="cabinet-create-preview" aria-label="Collection preview"><p class="overline">YOUR COLLECTION</p>'''+artwork('Books')+'''<h3>Books</h3><p>A name is enough. The rest can wait.</p></aside></div></section></main>'''
save('create-collection',shell(create,'Collections'))
colors=[('Canvas','#181915'),('Paper','#eae5d5'),('Butter','#e8dc9d'),('Favorite','#e4d79a'),('Meh','#d4dac3'),('Not again','#e3c2b5')]
identity='''<main class="identity-sheet"><header><p class="overline">WORTH / CABINET EDITION</p><h1>Good finds.<br>Mixed feelings.</h1><p>A little cabinet for your very particular taste.</p></header><section class="identity-calls">'''
for v,l in ref['labels'].items():identity+='<div>'+ref['face'](v,arms=True)+'<h2>'+l+'</h2><p>'+{'favorite':'Yes, again.','meh':'It was a thing.','would_not_again':'Once was plenty.'}[v]+'</p></div>'
identity+='</section><section class="identity-palette">'+''.join(f'<div><span style="background:{c}"></span><strong>{n}</strong><small>{c}</small></div>' for n,c in colors)+'</section><section class="identity-covers">'+''.join(artwork(n) for n in ['Drinks','Movies','Places'])+'</section><footer>DM Sans · DM Mono &nbsp; / &nbsp; Soft shapes. Clear choices. Very particular opinions.</footer></main>'
identity+='<style>.identity-sheet{max-width:1200px;margin:auto;padding:64px 40px}.identity-sheet h1{font-size:84px;font-weight:500;line-height:1;letter-spacing:-.065em;margin:20px 0}.identity-sheet header>p:last-child{color:var(--muted)}.identity-calls{display:grid;grid-template-columns:repeat(3,1fr);margin:48px 0;gap:20px}.identity-calls>div{background:var(--slip);color:var(--ink);border-radius:22px;padding:24px;text-align:center;--face-outline:#34382d}.identity-calls svg{width:144px;height:132px}.identity-calls h2{font-size:28px;font-weight:500;margin:0;letter-spacing:-.045em}.identity-calls p{font-size:12px;color:#67695b}.identity-palette{display:grid;grid-template-columns:repeat(6,1fr);gap:16px}.identity-palette>div{display:flex;flex-direction:column;gap:8px}.identity-palette span{height:44px;border-radius:10px;border:1px solid var(--line)}.identity-palette strong{font-size:12px;font-weight:400}.identity-palette small{font:10px var(--mono);color:var(--muted)}.identity-covers{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:40px}.identity-covers>div{aspect-ratio:1.6;border-radius:16px}.identity-sheet footer{color:var(--muted);font-size:12px;margin-top:36px}@media(max-width:680px){.identity-sheet{padding:32px 20px}.identity-sheet h1{font-size:48px}.identity-calls{grid-template-columns:1fr}.identity-palette{grid-template-columns:repeat(3,1fr)}.identity-covers{grid-template-columns:1fr}}</style>'
save('identity',identity)

undecided=ref['collection'].replace(ref['face'](arms=True),blank.replace('collection-empty-illustration','undecided-slips')).replace('<strong>Meh.</strong><span>It was a thing.</span>','<strong>Undecided.</strong><span>No opinion required.</span>').replace('data-choice="meh"','data-choice="none"').replace('class="active" aria-pressed="true"','class="" aria-pressed="false"').replace('</button>'+ref['badge']('meh')+'</div>','</button></div>',1)
save('collection-undecided',shell(undecided,'Collections'))
# The directory and starter choices use the same cover objects as the archive.
page_head='<main class="light-page lists-page page-width"><div class="page-head"><div><p class="overline">YOUR ARCHIVE</p><h1>Collections</h1><p>The good, the meh, and the “not again.”</p></div><div class="list-page-actions"><button class="button button-accent">+ New collection</button></div></div>'
directory=page_head+'<section class="list-directory"><header class="list-directory-head"><p class="overline">COLLECTIONS</p><span>3</span></header><div class="collection-directory-grid">'
for i,n in enumerate(['Drinks','Movies','Places'],1):
 directory+=f'<div class="collection-directory-entry"><a class="collection-directory-card cabinet-directory-card"><div class="cabinet-directory-picture">'+artwork(n)+f'<span class="collection-directory-index">0{i}</span></div><span class="collection-directory-copy"><strong>{n}</strong><small><span>{8 if i==1 else 1} items</span><span class="collection-directory-updated">Updated today</span></small></span><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor"><path d="M2 10h15m-6-5 5 5-5 5"/></svg></a></div>'
directory+='</div></section></main>'
save('directory',shell(directory,'Collections'))
starters=page_head+'<section class="list-suggestions"><p class="overline">NO COLLECTIONS YET</p><p class="starter-intro">An empty archive. Enjoy it while it lasts.</p><div>'
for n in ['Drinks','Movies','Places','Cars','Books','Music','Games']:
 starters+='<button class="starter-card cabinet-starter-card"><div class="cabinet-directory-picture">'+artwork(n)+'</div><span class="starter-card-copy"><strong>'+n+'</strong><small>collection</small></span><svg width="18" height="18" viewBox="0 0 18 18" stroke="currentColor"><path d="M9 3v12M3 9h12"/></svg></button>'
starters+='</div></section></main>'
save('starters',shell(starters,'Collections'))
