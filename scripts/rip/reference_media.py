# Owns limited Bink/MP3 decode verification and five visual reference frames per video.
import argparse
import json
from pathlib import Path
import subprocess


def run(root,output):
    output.mkdir(parents=True,exist_ok=True)
    sources=[root/'Videos/Intro.bik',root/'Videos/Hoellenorgel.bik',root/'Sound/Menue.mp3']
    inventory=[]
    for source in sources:
        result=subprocess.run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(source)],
                              check=True,capture_output=True,text=True)
        meta=json.loads(result.stdout)
        with (output/(source.stem+'.decode.log')).open('w') as log:
            subprocess.run(['ffmpeg','-nostdin','-hide_banner','-i',str(source),'-f','null','-'],
                           check=True,stdout=log,stderr=log)
        frames=[]
        if source.suffix=='.bik':
            duration=float(meta['format']['duration'])
            for i,fraction in enumerate([.1,.3,.5,.7,.9]):
                seconds=duration*fraction
                target=output/(source.stem+f'-{i+1:02d}.png')
                subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-i',str(source),'-ss',f'{seconds:.6f}',
                                '-frames:v','1','-update','1',str(target)],check=True)
                frames.append(dict(file=str(target),seconds=seconds))
        inventory.append(dict(source=str(source),probe=meta,frames=frames,
                        note='Representative frames at 10/30/50/70/90%; Bink decoder does not expose useful I-frame flags.'))
    (output/'manifest.json').write_text(json.dumps(inventory,indent=2)+'\n')
    print('Decoded two Bink videos and one MP3; saved ten PNG look-reference frames')


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('input',type=Path)
    parser.add_argument('output',type=Path)
    args=parser.parse_args()
    run(args.input,args.output)
