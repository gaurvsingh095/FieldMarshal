import subprocess,sys,os
src,out=sys.argv[1],sys.argv[2]
segs=[(0,7.3,1),(7.3,34.3,4),(34.3,39.3,1.25),(39.3,49.2,1),(49.2,57.4,3),(57.4,63.0,1),(63.0,72.8,3),(72.8,78.5,1),(78.5,90.9,3),(90.9,96.2,1),(96.2,126.0,5),(126.0,146.6,1)]
os.makedirs('seg',exist_ok=True);lst=[]
for i,(a,b,sp) in enumerate(segs):
    o=f'seg/s{i:02d}.mp4'
    subprocess.run(['ffmpeg','-v','error','-y','-ss',str(a),'-to',str(b),'-i',src,'-vf',f'setpts=(PTS-STARTPTS)/{sp},fps=30,format=yuv420p','-an','-c:v','libx264','-preset','veryfast','-crf','21','-threads','2',o],check=True);lst.append(f"file '{o}'")
open('seg/list.txt','w').write('\n'.join(l.replace('seg/','') for l in lst))
subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i','seg/list.txt','-c','copy','-movflags','+faststart',out],check=True)
print(sum((b-a)/sp for a,b,sp in segs))
