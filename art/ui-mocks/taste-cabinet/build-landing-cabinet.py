from pathlib import Path
import runpy
ref=runpy.run_path(str(Path(__file__).with_name('build-reference.py')))
root=Path(__file__).parent/'landing-cabinet';root.mkdir(exist_ok=True)
head=ref['head'].replace('../../../','../../../../')+'<link rel="stylesheet" href="../../../../src/details.css"><link rel="stylesheet" href="../../../../src/cabinet-edition.css"><link rel="stylesheet" href="../../../../src/landing-cabinet.css">'
hero='''<section class="landing-cabinet-hero"><p class="overline">YOUR TASTE, ON RECORD</p><h1>Your taste.<br><em>A place to keep it.</em></h1><p>Collect what you try. Rank what holds up.<br>Keep the meh, too.</p><div class="landing-cabinet-actions"><a class="button button-accent">Start your archive →</a><a>Try the example ↓</a></div></section><figure class="landing-cabinet-visual"><div class="landing-cabinet-folders" aria-hidden="true">'''
topics=[('Drinks','For research.','starter-covers/drinks-v2.svg'),('Midnight snacks','Several were necessary.','landing/midnight-snacks.svg'),('Questionable purchases','Seemed reasonable.','landing/questionable-purchases.svg')]
for name,caption,asset in topics:
 hero+='<div class="landing-cabinet-folder"><span><strong>'+name+'</strong><small>'+caption+'</small></span><img src="../../../../public/art/'+asset+'" alt=""></div>'
hero+='</div><div class="landing-cabinet-note"><p class="overline">COLD BREW / EXAMPLE</p><div><strong>Meh.</strong>'+ref['face']('meh')+'</div><p>It was a thing.</p></div><figcaption>EXAMPLE / A FEW THINGS, FILED.</figcaption></figure>'
landing=ref['landing'];a=landing.index('<div class="cabinet-demo-index">');z=landing.index('</section><footer',a);index=landing[a:z].replace('Movies','Midnight snacks').replace('Places','Questionable purchases')
body='<main class="cabinet-landing landing-cabinet"><header class="cabinet-landing-top"><span class="product-wordmark">worth</span><a>Sign in →</a></header>'+hero+'<header class="landing-example-heading"><p class="overline">EXAMPLE / MAKE YOUR CALL</p><h2>Go on. Have an opinion.</h2><p>Try the example. Nothing here is saved.</p></header><section class="cabinet-demo">'+ref['slip']('Cold brew','Coffee','02',True)+index+'</section><footer class="cabinet-landing-bottom"><strong>Meh is a complete sentence.</strong><span>Collections, rankings and activity logs. Your taste, on record.</span></footer></main>'
(root/'landing.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Worth · Illustrated cabinet</title>'+head+'<body>'+body+'</body></html>')
