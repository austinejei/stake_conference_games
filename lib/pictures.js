'use strict';
module.exports=[
 ['temple-garden','A house of the Lord','A white temple with a golden spire, flowers, and a garden path'],
 ['scriptures','Stories to treasure','An open book of scriptures with a ribbon bookmark on a wooden stand'],
 ['family-home','Love at home','A warm family home with a front door, windows, and a flowering garden'],
 ['ark','A rainbow of hope','A wooden ark on blue water beneath a bright rainbow'],
 ['kindness','Helping hands','Two helping hands holding a bright heart'],
 ['lantern','Let your light shine','A glowing lantern beside a winding path and green leaves'],
 ['chapel','Gather together','A welcoming chapel with a bell tower and a garden'],
 ['quiet-garden','A quiet moment','A garden bench beneath a leafy tree beside colourful flowers'],
 ['rainbow','Hope after the rain','A wide rainbow above hills, clouds, and flowers'],
 ['growing-seed','Small things grow','A young plant growing from rich soil in a terracotta pot'],
 ['service-basket','Something to share','A woven basket filled with bread, apples, and garden produce'],
 ['mountain-path','One step at a time','A winding walking path leading toward sunlit mountains'],
 ['music','Sing with joy','Colourful musical notes above an open songbook'],
 ['good-shepherd','Care for one another','A woolly sheep on green hills beside a shepherd’s staff'],
 ['temple-evening','A peaceful place','A temple with two towers beneath a warm evening sky']
].map(([id,title,alt])=>({id,title,alt,image:'/pictures/'+id+'.svg'}));
