import { Bell, BellOff, LogOut, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { enableWaiterNotifications, readWaiterAlertPreferences, writeWaiterAlertPreferences } from '@/lib/waiterAlerts';
import { useState } from 'react';
import { toast } from 'sonner';

export default function WaiterProfile() {
  const { user, username, logout } = useAuth();
  const [preferences, setPreferences] = useState(readWaiterAlertPreferences);
  const toggleSound = () => { const next = { ...preferences, soundEnabled: !preferences.soundEnabled }; writeWaiterAlertPreferences(next); setPreferences(next); };
  const enableNotifications = async () => { const enabled = await enableWaiterNotifications(); setPreferences(readWaiterAlertPreferences()); toast[enabled ? 'success' : 'warning'](enabled ? 'Notificações ativadas.' : 'Permita as notificações no navegador.'); };
  return <main className="space-y-4 p-4"><div><p className="text-sm font-medium text-primary">Minha conta</p><h1 className="text-2xl font-bold">Perfil do garçom</h1></div><Card><CardContent className="space-y-1 p-4"><p className="font-bold">{username || 'Colaborador'}</p><p className="text-sm text-muted-foreground">{user?.email}</p></CardContent></Card><Card><CardContent className="space-y-3 p-4"><div className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-primary"/><div><p className="font-semibold">Alertas deste aparelho</p><p className="text-sm text-muted-foreground">Chamados do QR Menu e atualizações do salão.</p></div></div><Button className="w-full" variant="outline" onClick={toggleSound}>{preferences.soundEnabled ? <BellOff className="mr-2 h-4 w-4"/> : <Bell className="mr-2 h-4 w-4"/>}{preferences.soundEnabled ? 'Silenciar sons' : 'Ativar sons'}</Button>{!preferences.notificationsEnabled && <Button className="w-full" onClick={() => void enableNotifications()}><Bell className="mr-2 h-4 w-4"/>Ativar notificações</Button>}</CardContent></Card><Button variant="destructive" className="w-full" onClick={() => void logout()}><LogOut className="mr-2 h-4 w-4"/>Sair</Button></main>;
}
