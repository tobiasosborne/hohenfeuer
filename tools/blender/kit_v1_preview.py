# tools/blender/kit_v1_preview.py - owns authored contact sheets and reference-only comparison strip layout.
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "assets/kit-v1"
COMPARE = ROOT / "assets-ripped/compare-v1"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def font(size):
    return ImageFont.truetype(FONT,size)


def contact():
    manifest = json.loads((OUTPUT/"manifest.json").read_text())
    cards = [*manifest["weapons"],*manifest["people"],*manifest["blocks"]]
    canvas = Image.new("RGB",(1280,1392),(30,36,41))
    d = ImageDraw.Draw(canvas)
    d.text((28,20),"HOHENFEUER / KIT V1",font=font(27),fill=(224,216,193))
    d.text((29,60),"Independent geometry + procedural paint  |  Blender 4.5.14  |  metres, +Y up",font=font(15),fill=(167,178,181))
    for i,item in enumerate(cards):
        x,y = (i%4)*320,96+(i//4)*320
        d.rounded_rectangle((x+8,y+4,x+312,y+308),radius=8,fill=(48,56,63))
        thumb = Image.open(OUTPUT/item["thumbnail"]).convert("RGB")
        canvas.paste(thumb,(x+32,y+12))
        d.text((x+26,y+273),item["key"].upper(),font=font(17),fill=(229,222,204))
        label=f"{item['triangles']} tris"
        if item["key"]=="air":
            label="empty cell"
            d.text((x+102,y+126),"AIR",font=font(23),fill=(209,219,222))
        d.text((x+216,y+277),label,font=font(12),fill=(172,184,185))
    canvas.save(OUTPUT/"thumbs/contact-sheet.png")
    damage = Image.new("RGB",(1120,3640),(30,36,41))
    d = ImageDraw.Draw(damage)
    for state,title in enumerate(["INTACT / >75%", "Z1 / >50%", "Z2 / >25%", "Z3 / <=25%"]):
        d.text((200+state*230,12),title,font=font(17),fill=(224,216,193))
    for row,block in enumerate(manifest["blocks"]):
        y=42+row*256
        d.text((18,y+104),block["key"],font=font(18),fill=(223,216,199))
        for state in range(4):
            name=block["key"]+(f"_z{state}" if state else "")
            thumb=Image.open(OUTPUT/"thumbs"/f"{name}.png").convert("RGB").resize((224,224))
            damage.paste(thumb,(190+state*230,y))
    damage.save(OUTPUT/"thumbs/damage-contact-sheet.png")


def comparisons():
    info=json.loads((COMPARE/"renders.json").read_text())
    for record in info["assets"]:
        canvas=Image.new("RGB",(1536,656),(29,35,40))
        d=ImageDraw.Draw(canvas)
        for side,label in enumerate([record["reference_label"],record["authored_label"]]):
            path=COMPARE/".frames"/f"{record['key']}-{'original' if side==0 else 'authored'}.png"
            panel=Image.open(path).convert("RGB")
            canvas.paste(panel,(side*768,48))
            d.text((side*768+20,15),label,font=font(18),fill=(231,224,206))
        d.text((20,628),record["note"],font=font(14),fill=(164,178,184))
        canvas.save(COMPARE/f"{record['key']}.png")
    d=ImageDraw.Draw(canvas)
    # A small review index keeps full-size strips easy to locate.
    rows=(len(info["assets"])+3)//4
    sheet=Image.new("RGB",(1536,rows*180),(29,35,40))
    for i,record in enumerate(info["assets"]):
        thumb=Image.open(COMPARE/f"{record['key']}.png").resize((384,164))
        sheet.paste(thumb,((i%4)*384,(i//4)*180))
    sheet.save(COMPARE/"contact-sheet.png")


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--contact",action="store_true")
    parser.add_argument("--compare",action="store_true")
    args=parser.parse_args()
    if args.contact:
        contact()
    if args.compare:
        comparisons()
