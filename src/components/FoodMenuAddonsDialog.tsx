import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
const db=supabase as any;
type Option={id:string;name:string;price:number};
type Group={id:string;name:string;required:boolean;food_menu_addon_options:Option[]};
export function FoodMenuAddonsDialog({open,onOpenChange,menuProductId,productName}:{open:boolean;onOpenChange:(v:boolean)=>void;menuProductId:string;productName:string}){
 const[groups,setGroups]=useState<Group[]>([]),[loading,setLoading]=useState(false),[groupName,setGroupName]=useState('');
 const load=async()=>{setLoading(true);const{data,error}=await db.from('food_menu_addon_groups').select('id,name,required,food_menu_addon_options(id,name,price)').eq('menu_product_id',menuProductId).eq('active',true);setLoading(false);if(error)toast.error('Não foi possível carregar adicionais.');else setGroups(data??[])};
 useEffect(()=>{if(open)void load()},[open,menuProductId]);
 const addGroup=async()=>{if(!groupName.trim())return;const{error}=await db.from('food_menu_addon_groups').insert({menu_product_id:menuProductId,name:groupName.trim(),max_select:5});if(error)toast.error('Não foi possível criar o grupo.');else{setGroupName('');await load()}};
 const addOption=async(groupId:string,name:string,price:number)=>{if(!name.trim())return;const{error}=await db.from('food_menu_addon_options').insert({addon_group_id:groupId,name:name.trim(),price});if(error)toast.error('Não foi possível criar o adicional.');else await load()};
 const remove=async(table:string,id:string)=>{const{error}=await db.from(table).delete().eq('id',id);if(error)toast.error('Não foi possível excluir.');else await load()};
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto"><DialogHeader><DialogTitle>Adicionais · {productName}</DialogTitle></DialogHeader>{loading?<Loader2 className="mx-auto my-10 animate-spin"/>:<div className="space-y-4">{groups.map(group=><div key={group.id} className="rounded-xl border p-4"><div className="flex justify-between gap-3"><strong>{group.name}</strong><Button size="icon" variant="ghost" onClick={()=>void remove('food_menu_addon_groups',group.id)}><Trash2 className="h-4 w-4"/></Button></div><div className="mt-3 space-y-2">{group.food_menu_addon_options?.map(option=><div key={option.id} className="flex justify-between rounded-lg bg-muted p-2 text-sm"><span>{option.name}</span><span className="flex items-center gap-2"><strong>{Number(option.price).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong><Button size="icon" variant="ghost" onClick={()=>void remove('food_menu_addon_options',option.id)}><Trash2 className="h-3.5 w-3.5"/></Button></span></div>)}<NewOption onAdd={(name,price)=>void addOption(group.id,name,price)}/></div></div>)}<div className="flex gap-2 border-t pt-4"><Input placeholder="Novo grupo de adicionais" value={groupName} onChange={e=>setGroupName(e.target.value)}/><Button onClick={()=>void addGroup()}><Plus className="mr-2 h-4 w-4"/>Grupo</Button></div></div>}</DialogContent></Dialog>
}
function NewOption({onAdd}:{onAdd:(name:string,price:number)=>void}){const[name,setName]=useState(''),[price,setPrice]=useState('0');return <div className="flex gap-2"><Input placeholder="Novo adicional" value={name} onChange={e=>setName(e.target.value)}/><Input className="w-24" type="number" min="0" step=".01" value={price} onChange={e=>setPrice(e.target.value)}/><Button size="icon" variant="outline" onClick={()=>{onAdd(name,Number(price)||0);setName('');setPrice('0')}}><Plus className="h-4 w-4"/></Button></div>}
