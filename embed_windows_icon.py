#!/usr/bin/env python3
"""Embed multi-resolution RT_ICON + RT_GROUP_ICON resources in a Go-built PE32+ executable.
No pip dependencies. Use immediately after go build, before producing the release checksum.
"""
from __future__ import annotations
import struct
import sys
from pathlib import Path

ALIGN=lambda a,b:(a+b-1)//b*b


def ico_resources(path):
    b=Path(path).read_bytes()
    reserved, kind, count=struct.unpack_from('<HHH',b,0)
    if (reserved,kind)!=(0,1) or count<1:
        raise ValueError('Not an ICO file')
    images={}
    group=bytearray(struct.pack('<HHH',0,1,count))
    for n in range(count):
        width,height,colors,blank,planes,bpp,length,offset=struct.unpack_from('<BBBBHHII',b,6+16*n)
        blob=b[offset:offset+length]
        if len(blob)!=length:raise ValueError('Invalid icon image length')
        image_id=n+1
        images[image_id]={1033:blob}
        group.extend(struct.pack('<BBBBHHIH',width,height,colors,blank,planes,bpp,length,image_id))
    return {3:images,14:{1:{1033:bytes(group)}}},count


def pack_resources(tree,rva):
    raw=bytearray()
    data_entries=[]
    def alloc(size,align=4):
        pos=ALIGN(len(raw),align)
        raw.extend(b'\0'*(pos+size-len(raw)))
        return pos
    def directory(node):
        keys=sorted(node)
        pos=alloc(16+8*len(keys))
        # resource metadata: DWORD Characteristics, Time, WORD major/minor, name/ID entry counts
        struct.pack_into('<IIHHHH',raw,pos,0,0,0,0,0,len(keys))
        for i,key in enumerate(keys):
            child=node[key]
            if isinstance(child,dict):pointer=0x80000000|directory(child)
            else:
                pointer=alloc(16)
                data_entries.append((pointer,child))
            struct.pack_into('<II',raw,pos+16+i*8,key,pointer)
        return pos
    assert directory(tree)==0
    for pos,data in data_entries:
        off=alloc(len(data))
        raw[off:off+len(data)]=data
        struct.pack_into('<IIII',raw,pos,rva+off,len(data),0,0)
    return bytes(raw)


def embed_icon(exe,ico):
    data=bytearray(Path(exe).read_bytes())
    pe=struct.unpack_from('<I',data,0x3c)[0]
    if data[pe:pe+4]!=b'PE\0\0':raise ValueError('Not a PE')
    machine,nsec,_,ptrsym,_,optsize,_=struct.unpack_from('<HHIIIHH',data,pe+4)
    if machine!=0x8664:raise ValueError('Expected Windows x64')
    opt=pe+24
    if struct.unpack_from('<H',data,opt)[0]!=0x20b:raise ValueError('Expected PE32+')
    sa,fa=struct.unpack_from('<II',data,opt+32)
    secbase=opt+optsize
    secend=secbase+40*nsec
    first_raw=min(struct.unpack_from('<I',data,secbase+40*i+20)[0] for i in range(nsec))
    if secend+40>first_raw:raise ValueError('No room for new section header')
    section_list=[struct.unpack_from('<8sIIIIIIHHI',data,secbase+40*i) for i in range(nsec)]
    if any(sec[0].startswith(b'.rsrc') for sec in section_list):
        raise ValueError('PE already has resource section; refusing double-embed')
    virtual_rva=ALIGN(max(s[2]+max(s[1],s[3]) for s in section_list),sa)
    tree,n=ico_resources(ico)
    contents=pack_resources(tree,virtual_rva)
    offset=ALIGN(len(data),fa)
    data.extend(b'\0'*(offset-len(data)))
    raw_size=ALIGN(len(contents),fa)
    data.extend(contents+b'\0'*(raw_size-len(contents)))
    struct.pack_into('<8sIIIIIIHHI',data,secend,b'.rsrc\0\0\0',len(contents),virtual_rva,raw_size,offset,0,0,0,0,0x40000040)
    struct.pack_into('<H',data,pe+6,nsec+1)
    struct.pack_into('<I',data,opt+8,struct.unpack_from('<I',data,opt+8)[0]+raw_size)
    struct.pack_into('<I',data,opt+56,ALIGN(virtual_rva+len(contents),sa))
    struct.pack_into('<II',data,opt+112,virtual_rva,len(contents))
    # Microsoft PE checksum: fold 16-bit words excluding the checksum field and add file length.
    struct.pack_into('<I',data,opt+64,0)
    checksum=0
    for i in range(0,len(data),2):
        x=data[i]+((data[i+1] if i+1<len(data) else 0)<<8)
        checksum=(checksum+x)&0xffffffff
        checksum=(checksum&0xffff)+(checksum>>16)
    checksum=(checksum&0xffff)+(checksum>>16)
    checksum=(checksum+len(data))&0xffffffff
    struct.pack_into('<I',data,opt+64,checksum)
    Path(exe).write_bytes(data)
    # Verify the directory really resolves to expected resource types, IDs, and language.
    parsed=validate(exe)
    assert len(parsed[3])==n and len(parsed[14])==1,parsed
    return parsed


def validate(path):
    b=Path(path).read_bytes();pe=struct.unpack_from('<I',b,0x3c)[0];opt=pe+24
    base,size=struct.unpack_from('<II',b,opt+112)
    if not base or not size:raise ValueError('Missing icon resource directory')
    secbase=opt+struct.unpack_from('<H',b,pe+20)[0]
    sections=struct.unpack_from('<H',b,pe+6)[0]
    sec=[struct.unpack_from('<8sIIIIIIHHI',b,secbase+40*i) for i in range(sections)]
    mapped=[s for s in sec if s[2]<=base<=(s[2]+s[1])]
    if len(mapped)!=1:raise ValueError('Missing resource section')
    off=mapped[0][4]+base-mapped[0][2]
    def walk(at,depth=0):
        _,_,_,_,named,ids=struct.unpack_from('<IIHHHH',b,off+at)
        out={}
        for k in range(named+ids):
            eid,ptr=struct.unpack_from('<II',b,off+at+16+k*8)
            if ptr&0x80000000:out[eid]=walk(ptr&0x7fffffff,depth+1)
            else:
                rva,n,_,_=struct.unpack_from('<IIII',b,off+ptr)
                location=off+(rva-base)
                if location<0 or location+n>len(b):raise ValueError('Invalid data entry RVA')
                out[eid]=len(b[location:location+n])
        return out
    return walk(0)


if __name__=='__main__':
    if len(sys.argv)!=3:raise SystemExit('Usage: python embed_windows_icon.py <installer.exe> <logo.ico>')
    print('Embedded resource tree:',embed_icon(sys.argv[1],sys.argv[2]))
