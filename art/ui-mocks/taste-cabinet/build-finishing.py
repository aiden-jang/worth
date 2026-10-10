"""Secondary cabinet compositions; fixtures exist only in these references."""
from pathlib import Path
import runpy
ref = runpy.run_path(str(Path(__file__).with_name('build-edition.py')))
save, shell, blank = ref['save'], ref['shell'], ref['blank']
def quiet(title, copy, action=''):
    return '<section class="cabinet-quiet-state">'+blank+'<div><h2>'+title+'</h2><p>'+copy+'</p>'+action+'</div></section>'
search='<main class="light-page search-page page-width"><p class="overline">YOUR ARCHIVE, ALL AT ONCE</p><h1>Find that thing.</h1><label class="global-search"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg><input autofocus placeholder="A film, a place, a good drink…"></label>'
save('search-empty',shell(search+quiet('Somewhere in here.','Type at least two characters to search your lists and logs.')+'</main>','Search'))
results='<section class="search-results"><div class="search-results-head"><p class="overline">2 RESULTS</p><div class="search-scope"><button class="active">All <span>2</span></button><button>Lists <span>0</span></button><button>Items <span>2</span></button><button>Logs <span>0</span></button></div></div><section class="search-group" aria-label="Items"><p>Items</p>'
for t,d in [('Lagavulin 16','Whiskey'),('A very particular drink from a very particular evening','A name you will actually recognize later.')]:
    results+='<a><span><small>Drinks / ITEM</small><strong>'+t+'</strong><em>'+d+'</em></span><span>↗</span></a>'
results+='</section></section>'
save('search-results',shell(search.replace('placeholder="A film, a place, a good drink…"','value="drink"').replace('</label>', '<button class="search-clear" aria-label="Clear search"><svg width="18" height="18" viewBox="0 0 18 18" stroke="currentColor"><path d="m4 4 10 10M14 4 4 14"/></svg></button></label>')+results+'</main>','Search'))
patterns='<main class="light-page patterns-page page-width"><header class="patterns-head"><p class="overline">YOUR ARCHIVE</p><h1>Patterns</h1><p>A few patterns. No personality diagnosis.</p></header>'
save('patterns-empty',shell(patterns+quiet('Too soon to tell.','Keep a few items or activity logs. Patterns will appear here.','<a class="button button-accent">Start a collection →</a>')+'</main>','Patterns'))
stats='<section class="pattern-stat-grid">'+''.join('<article><p>'+label+'</p><strong>'+str(n)+'</strong><span>'+detail+'</span></article>' for label,n,detail in [('Records',8,'Items and activity logs'),('Ranked',5,'Items placed in order'),('Revisits',0,'Returns to a collection item')])+'</section>'
face=ref['ref']['face']
labels=ref['ref']['labels']
asides={'favorite':'Yes, again.','meh':'It was a thing.','would_not_again':'Once was plenty.'}
distribution='<section class="call-distribution"><header><div><p class="overline">YOUR CALLS</p><h2>Mixed feelings, on record.</h2></div><span>4 calls</span></header><div class="call-distribution-grid">'
for v,n in [('favorite',2),('meh',1),('would_not_again',1)]:
    distribution+='<article>'+face(v)+'<div><h3>'+labels[v]+'</h3><span>'+asides[v]+'</span></div><strong>'+str(n)+'</strong><div class="call-count-track"><span style="width:'+str(n/4*100)+'%"></span></div></article>'
distribution+='</div><p class="call-distribution-footnote">Only items with a call. Rankings are a separate matter.</p></section>'
notes='<section class="pattern-notes"><article><p class="overline">MOST RETURNED TO</p><p>Log a return to an item and it will appear here.</p></article><article><p class="overline">NEWEST COLLECTION</p><a><strong>Drinks</strong><span>8 items kept so far</span><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor"><path d="M2 9h13m-5-5 5 5-5 5"/></svg></a></article><article><p class="overline">LAST TOUCHED</p><p>Make a collection when you have something worth keeping close.</p></article><article><p class="overline">MOST KEPT IN</p><a><strong>Drinks</strong><span>8 items kept so far</span><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor"><path d="M2 9h13m-5-5 5 5-5 5"/></svg></a></article><article class="pattern-archive-scope"><p class="overline">ARCHIVE SHAPE</p><strong>3</strong><span>3 collections · 0 activities</span></article></section>'
save('patterns',shell(patterns+stats+distribution+notes+'</main>','Patterns'))
