# Owns the reproducible reference-only asset rip pipeline and optional Blender verification.
import argparse
import os
import subprocess
from pathlib import Path
import sys


def main():
    parser=argparse.ArgumentParser(description='Rip original game data without ever executing CD software.')
    parser.add_argument('input',type=Path)
    parser.add_argument('output',type=Path)
    parser.add_argument('--render',action='store_true')
    parser.add_argument('--blender',type=Path,default=Path('/home/tobias/Apps/blender-4.5.14-linux-x64/blender'))
    args=parser.parse_args()
    scripts=Path(__file__).resolve().parent
    def run(name,*values):
        subprocess.run([sys.executable,'-I','-B',str(scripts/name),*map(str,values)],check=True)
    run('unpack_cpr.py',args.input/'Data/Main.cpr',args.output/'Main')
    run('unpack_tex.py',args.input/'Graphics',args.output/'tex')
    run('tex2png.py',args.output/'tex',args.output/'textures')
    run('tex2png.py',args.output/'Main',args.output/'images')
    run('unpack_sks.py',args.input/'Videos',args.output/'sks')
    run('decode_data.py',args.output/'Main',args.output/'data','--exe',args.input/'Ballerburg.exe')
    run('mesh2obj.py',args.output/'Main/Objects',args.output/'meshes','--textures',args.output/'textures')
    for theme in ['Wueste','Schnee','Vulkan','Alien']:
        run('mesh2obj.py',args.output/'Main/Objects/Buildings',args.output/'variants'/theme,
            '--textures',args.output/'textures','--theme',theme)
    for installer in ['MinInst','MaxInst']:
        run('unpack_installer.py',args.input/(installer+'.exe'),args.output/'installers'/installer)
    run('reference_media.py',args.input,args.output/'video-frames')
    run('verify_outputs.py',args.output)
    if args.render:
        blender_env=dict(os.environ,BLENDER_USER_CONFIG='/tmp/claude-1000/rip/blender-config',
                         BLENDER_USER_EXTENSIONS='/tmp/claude-1000/rip/blender-extensions')
        subprocess.run([str(args.blender),'-b','-t','4','--python',str(scripts/'render_thumbs.py'),
                        '--','--meshes',str(args.output/'meshes'),'--output',str(args.output/'thumbs'),'--extras'],check=True,env=blender_env)
        run('verify_outputs.py',args.output)


if __name__=='__main__':
    main()
