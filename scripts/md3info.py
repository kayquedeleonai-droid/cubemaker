import struct,sys
d=open(sys.argv[1],'rb').read()
ident,ver,name,flags,nf,nt,ns,nsk,ofr,otg,osf,oend=struct.unpack('<4si64siiiiiiiii',d[:108])
print(ident,ver,name.rstrip(b'\0'),'frames',nf,'tags',nt,'surfs',ns)
for i in range(nt):
    o=otg+i*112; print(' tag',d[o:o+64].rstrip(b'\0'),struct.unpack('<3f',d[o+64:o+76]))
o=osf
for i in range(ns):
    h=struct.unpack('<4s64siiiiiiiiii',d[o:o+108])
    print(' surf',h[1].rstrip(b'\0'),'frames',h[3],'shaders',h[4],'verts',h[5],'tris',h[6])
    o+=h[11]
