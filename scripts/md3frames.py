import struct,sys
d=open(sys.argv[1],'rb').read()
nf,nt,ns=struct.unpack('<iii',d[76:88]); osf=struct.unpack('<i',d[100:104])[0]
o=osf
for s in range(ns):
    h=struct.unpack('<4s64siiiiiiiiii',d[o:o+108]); nv=h[5]; ox=h[10]
    print(h[1].rstrip(b'\0'))
    base=None
    for f in range(nf):
        p=o+ox+f*nv*8
        vs=[struct.unpack('<3h',d[p+i*8:p+i*8+6]) for i in range(nv)]
        if base is None: base=vs
        diff=max(max(abs(a-b) for a,b in zip(v,w)) for v,w in zip(vs,base))/64
        print(' frame',f,'maxdiff',round(diff,2))
    o+=h[11]
