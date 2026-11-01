import sys,json,re
from pathlib import Path
sys.path.insert(0,str(Path('tmp/pdfs/renderer').resolve()))
import pymupdf
from PIL import Image,ImageOps,ImageDraw
checks=json.loads(Path('verification/v124-pdf-checks.json').read_text(encoding='utf-8-sig'))
checks+=json.loads(Path('verification/v124-calendar-pdf-checks.json').read_text(encoding='utf-8'))['outputs']
rendered=Path('tmp/pdfs/v124-rendered');rendered.mkdir(parents=True,exist_ok=True)
thumbs=[];report=[]
for check in checks:
    doc=pymupdf.open(Path('tmp/pdfs/v124-generated')/check['filename'])
    text='\n'.join(page.get_text() for page in doc)
    for label in ['乗車券購入シミュレーション','計算対象期間','日本時間','総購入金額','購入日・券種']:
        assert label in text,(check['filename'],label)
    assert '\ufffd' not in text
    for label in ['横浜 ⇔ 東京','JR東海道線','定期券種別','528円','シミュレーション日時','出力日時','普通乗車券：','最安方法との差額','購入スケジュール']:
        assert label in text,(check['filename'],label)
    if check.get('sample')=='02':
        assert '学校が証明した通学区間' in text
    for plan in check['plans']:
        assert plan['label'] in text
        assert f"{plan['cost']:,}円" in text
    for index,page in enumerate(doc):
        for word in page.get_text('words'):
            assert word[0]>=0 and word[1]>=0 and word[2]<=page.rect.width+1 and word[3]<=page.rect.height+1,(check['filename'],index,word)
        dest=rendered/f"{Path(check['filename']).stem}-{index+1}.png"
        page.get_pixmap(matrix=pymupdf.Matrix(1.35,1.35)).save(dest)
        image=Image.open(dest).convert('RGB');image.thumbnail((300,430))
        tile=Image.new('RGB',(320,465),'#e8e8e8');tile.paste(image,((320-image.width)//2,25))
        ImageDraw.Draw(tile).text((10,5),f"{check['filename']} p{index+1}",fill='black')
        thumbs.append(tile)
    continued = [i for i,page in enumerate(doc) if page.get_text().strip().startswith('購入順・購入日・券種')]
    first_detail_page=None
    if check['selection']=='ALL':
        first_page=doc[0].get_text()
        assert '全購入パターンの比較一覧' in first_page
        assert '購入スケジュール（上から順に購入）' not in first_page
        for plan in check['plans']:
            assert plan['label'] in first_page
            assert f"{plan['cost']:,}円" in first_page
        first_detail_page=next(i+1 for i,page in enumerate(doc) if '購入スケジュール（上から順に購入）' in page.get_text())
        assert first_detail_page==2,(check['filename'],first_detail_page)
    if check['filename']=='sample06_ALL.pdf':
        assert len(continued)>=1
        Image.open(rendered/f"sample06_ALL-{continued[0]+1}.png").save('verification/v124-pdf-continuation.png')
    report.append({'file':check['filename'],'pages':len(doc),'japanese_text':True,'within_page':True,'continued_table_headers':len(continued),'first_detail_page':first_detail_page})
    if check['filename']=='sample02_BEST.pdf':
        Image.open(rendered/'sample02_BEST-1.png').save('verification/v124-pdf-student-best.png')
    if check['filename']=='sample07_RTT.pdf':
        Image.open(rendered/'sample07_RTT-1.png').save('verification/v124-pdf-irregular.png')
    if check['filename']=='ux_ALL.pdf':
        Image.open(rendered/'ux_ALL-1.png').save('verification/v124-pdf-all-comparison.png')
        Image.open(rendered/'ux_ALL-2.png').save('verification/v124-pdf-all-detail.png')
    doc.close()
contact=Image.new('RGB',(960,465*((len(thumbs)+2)//3)),'white')
for n,tile in enumerate(thumbs):contact.paste(tile,((n%3)*320,(n//3)*465))
contact.save('verification/v124-pdf-overview.png')
Path('verification/v124-pdf-render-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8',newline='\n')
print(json.dumps(report,ensure_ascii=False))
