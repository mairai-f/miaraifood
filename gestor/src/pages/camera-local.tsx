import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';

/**
 * MIAR AI/FOOD — Gestor · Câmeras
 *
 * Dois modos:
 *  - Webcam do computador (getUserMedia): a câmera do próprio aparelho onde
 *    o navegador está aberto. Não depende de rede, só de permissão do
 *    navegador.
 *  - Câmera IP (rede local): câmera de segurança de verdade, no mesmo Wi-Fi
 *    do estabelecimento. Cobre os protocolos mais comuns de CFTV comercial
 *    no Brasil (Intelbras, Hikvision, Dahua) via preset de URL, além de uma
 *    opção genérica pra digitar a URL MJPEG/RTSP direto.
 *
 * Limitação honesta: pré-visualização ao vivo no navegador só funciona pra
 * streams MJPEG (o navegador decodifica nativamente via <img>). RTSP não
 * tem suporte nativo em navegador nenhum — pra ver ao vivo seria necessário
 * um servidor intermediário fazendo RTSP→HLS/MJPEG, que não está montado
 * ainda. A URL RTSP mesmo assim é salva (útil pra outras integrações/NVR),
 * só a pré-visualização instantânea fica limitada ao MJPEG por enquanto.
 */

type CameraConfig = { id: string; name: string; type: 'device' | 'mjpeg' | 'hls'; url?: string };

type Marca = 'generica-mjpeg' | 'generica-rtsp' | 'intelbras' | 'hikvision' | 'dahua';

const MARCAS: { id: Marca; label: string; tipo: 'mjpeg' | 'rtsp'; montarUrl: (p: CamParams) => string; obs: string }[] = [
  {
    id: 'generica-mjpeg',
    label: 'Genérica — MJPEG (URL manual)',
    tipo: 'mjpeg',
    montarUrl: (p) => p.urlManual,
    obs: 'Cole a URL MJPEG completa que o fabricante da câmera fornece (geralmente termina em .cgi, /video ou /mjpg).',
  },
  {
    id: 'generica-rtsp',
    label: 'Genérica — RTSP (URL manual)',
    tipo: 'rtsp',
    montarUrl: (p) => p.urlManual,
    obs: 'Cole a URL RTSP completa (rtsp://usuario:senha@ip:porta/...). Salva pra uso em NVR/integrações — sem pré-visualização instantânea aqui.',
  },
  {
    id: 'intelbras',
    label: 'Intelbras (linha VIP/iM5)',
    tipo: 'rtsp',
    montarUrl: (p) => `rtsp://${p.usuario}:${p.senha}@${p.ip}:${p.porta || '554'}/cam/realmonitor?channel=${p.canal || '1'}&subtype=0`,
    obs: 'Padrão RTSP Intelbras. Confira o canal exato no app iNVR/Guarda se não for o 1.',
  },
  {
    id: 'hikvision',
    label: 'Hikvision',
    tipo: 'rtsp',
    montarUrl: (p) => `rtsp://${p.usuario}:${p.senha}@${p.ip}:${p.porta || '554'}/Streaming/Channels/${p.canal || '101'}`,
    obs: 'Padrão RTSP Hikvision (canal 101 = câmera 1, stream principal).',
  },
  {
    id: 'dahua',
    label: 'Dahua',
    tipo: 'rtsp',
    montarUrl: (p) => `rtsp://${p.usuario}:${p.senha}@${p.ip}:${p.porta || '554'}/cam/realmonitor?channel=${p.canal || '1'}&subtype=0`,
    obs: 'Padrão RTSP Dahua — mesmo formato usado por várias câmeras Intelbras (fabricadas sob a mesma base).',
  },
];

type CamParams = { ip: string; porta: string; usuario: string; senha: string; canal: string; urlManual: string };

function getToken() {
  return window.localStorage.getItem('miar-owner-token') ?? window.sessionStorage.getItem('miar-owner-token') ?? '';
}

export default function CameraLocal() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [on, setOn] = useState(false);

  const [modo, setModo] = useState<'webcam' | 'ip'>('webcam');
  const [cameras, setCameras] = useState<CameraConfig[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [marca, setMarca] = useState<Marca>('intelbras');
  const [nome, setNome] = useState('');
  const [params, setParams] = useState<CamParams>({ ip: '', porta: '', usuario: 'admin', senha: '', canal: '', urlManual: '' });
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    fetch('/api/settings', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : { cameras: [] }))
      .then((s) => setCameras(Array.isArray(s.cameras) ? s.cameras : []))
      .finally(() => setCarregando(false));
  }, []);

  const salvarCameras = async (novaLista: CameraConfig[]) => {
    setSalvando(true);
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ cameras: novaLista }),
      });
      setCameras(novaLista);
    } finally {
      setSalvando(false);
    }
  };

  const marcaAtual = MARCAS.find((m) => m.id === marca)!;
  const urlMontada = marcaAtual.montarUrl(params);

  const adicionarCameraIp = () => {
    if (!nome.trim() || !urlMontada.trim()) return;
    const nova: CameraConfig = {
      id: `cam-${Date.now()}`,
      name: nome.trim(),
      type: marcaAtual.tipo === 'mjpeg' ? 'mjpeg' : 'hls', // rtsp cru fica marcado como "hls" só como slot de metadado — sem player nativo ainda
      url: urlMontada.trim(),
    };
    salvarCameras([...cameras, nova]);
    setNome('');
    setParams({ ip: '', porta: '', usuario: 'admin', senha: '', canal: '', urlManual: '' });
    setImgError(false);
  };

  const removerCamera = (id: string) => {
    salvarCameras(cameras.filter((c) => c.id !== id));
  };

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setOn(false);
  };

  const start = async (id?: string) => {
    setError('');
    stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: id ? { deviceId: { exact: id } } : true,
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setOn(true);
      const list = await navigator.mediaDevices.enumerateDevices();
      const cams = list.filter((d) => d.kind === 'videoinput');
      setDevices(cams);
      if (!deviceId && cams[0]) setDeviceId(cams[0].deviceId);
    } catch (e) {
      setError('Não foi possível abrir a câmera. Permita o acesso no navegador.');
      setOn(false);
    }
  };

  useEffect(() => () => stop(), []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#06100A', overflowY: 'auto' }}>
      <div style={{ padding: '8px 8px 0' }}>
        <Link href="/painel" style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none' }}>← Voltar</Link>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: 8 }}>
        <button onClick={() => setModo('webcam')} style={tabStyle(modo === 'webcam')}>Webcam do computador</button>
        <button onClick={() => setModo('ip')} style={tabStyle(modo === 'ip')}>Câmera IP (rede local)</button>
      </div>

      {modo === 'webcam' && (
        <>
          <div style={{ display: 'flex', gap: 8, padding: 8, alignItems: 'center' }}>
            {!on ? (
              <button onClick={() => start(deviceId || undefined)} style={btnStyle(true)}>Ligar câmera</button>
            ) : (
              <button onClick={stop} style={btnStyle(false)}>Desligar</button>
            )}
            {devices.length > 1 && (
              <select
                value={deviceId}
                onChange={(e) => { setDeviceId(e.target.value); start(e.target.value); }}
                style={selectStyle}
              >
                {devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || `Câmera ${i + 1}`}</option>
                ))}
              </select>
            )}
          </div>
          <div style={{ flex: 1, position: 'relative', minHeight: 240 }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }}
            />
            {!on && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: '#8FA396', fontSize: 13, textAlign: 'center', padding: 16,
              }}>
                {error || 'Câmera desligada. Toque em Ligar câmera.'}
              </div>
            )}
          </div>
        </>
      )}

      {modo === 'ip' && (
        <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 12, color: '#94a3b8', background: '#0B1A10', border: '1px solid #16301F', borderRadius: 8, padding: 10 }}>
            A câmera precisa estar no <strong>mesmo Wi-Fi</strong> do estabelecimento (mesma rede local) que o
            dispositivo usado pra cadastrar/visualizar. Câmeras em rede diferente ou acessadas só por app do
            fabricante fora dessa rede não vão funcionar aqui.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#0B1A10', border: '1px solid #16301F', borderRadius: 8, padding: 12 }}>
            <label style={labelStyle}>Nome da câmera</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Entrada, Cozinha, Caixa" style={inputStyle} />

            <label style={labelStyle}>Marca / protocolo</label>
            <select value={marca} onChange={(e) => { setMarca(e.target.value as Marca); setImgError(false); }} style={selectStyle}>
              {MARCAS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <p style={{ fontSize: 11, color: '#7d8a99', margin: 0 }}>{marcaAtual.obs}</p>

            {marcaAtual.id === 'generica-mjpeg' || marcaAtual.id === 'generica-rtsp' ? (
              <>
                <label style={labelStyle}>URL completa</label>
                <input
                  value={params.urlManual}
                  onChange={(e) => setParams((p) => ({ ...p, urlManual: e.target.value }))}
                  placeholder={marcaAtual.id === 'generica-mjpeg' ? 'http://192.168.1.50/mjpg/video.mjpg' : 'rtsp://admin:senha@192.168.1.50:554/stream1'}
                  style={inputStyle}
                />
              </>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                <div>
                  <label style={labelStyle}>IP da câmera</label>
                  <input value={params.ip} onChange={(e) => setParams((p) => ({ ...p, ip: e.target.value }))} placeholder="192.168.1.50" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Porta (opcional)</label>
                  <input value={params.porta} onChange={(e) => setParams((p) => ({ ...p, porta: e.target.value }))} placeholder="554" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Usuário</label>
                  <input value={params.usuario} onChange={(e) => setParams((p) => ({ ...p, usuario: e.target.value }))} placeholder="admin" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Senha</label>
                  <input type="password" value={params.senha} onChange={(e) => setParams((p) => ({ ...p, senha: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Canal (opcional)</label>
                  <input value={params.canal} onChange={(e) => setParams((p) => ({ ...p, canal: e.target.value }))} placeholder="1" style={inputStyle} />
                </div>
              </div>
            )}

            <label style={labelStyle}>URL gerada</label>
            <code style={{ fontSize: 11, color: '#9EF01A', wordBreak: 'break-all', background: '#06100A', padding: 8, borderRadius: 6 }}>
              {urlMontada || '—'}
            </code>

            {marcaAtual.tipo === 'mjpeg' && urlMontada && (
              <div style={{ marginTop: 4 }}>
                <p style={{ fontSize: 11, color: '#7d8a99', margin: '0 0 6px' }}>Pré-visualização:</p>
                {!imgError ? (
                  <img
                    src={urlMontada}
                    alt="Pré-visualização da câmera"
                    onError={() => setImgError(true)}
                    style={{ width: '100%', maxHeight: 220, objectFit: 'contain', background: '#000', borderRadius: 8 }}
                  />
                ) : (
                  <p style={{ fontSize: 12, color: '#f87171' }}>
                    Não foi possível carregar essa URL. Confira IP/porta/usuário/senha e se a câmera está no mesmo Wi-Fi.
                  </p>
                )}
              </div>
            )}
            {marcaAtual.tipo === 'rtsp' && (
              <p style={{ fontSize: 11, color: '#f59e0b', margin: 0 }}>
                RTSP não tem pré-visualização direta no navegador — a URL é salva e fica disponível pra uso em
                NVR/integrações. Câmera fica cadastrada mesmo sem preview aqui.
              </p>
            )}

            <button onClick={adicionarCameraIp} disabled={salvando || !nome.trim() || !urlMontada.trim()} style={{ ...btnStyle(true), marginTop: 4 }}>
              {salvando ? 'Salvando...' : 'Salvar câmera'}
            </button>
          </div>

          <div>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 8px', fontWeight: 700 }}>
              Câmeras cadastradas {carregando ? '' : `(${cameras.length})`}
            </p>
            {carregando ? (
              <p style={{ fontSize: 12, color: '#7d8a99' }}>Carregando...</p>
            ) : cameras.length === 0 ? (
              <p style={{ fontSize: 12, color: '#7d8a99' }}>Nenhuma câmera cadastrada ainda.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {cameras.map((c) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0B1A10', border: '1px solid #16301F', borderRadius: 8, padding: '8px 12px' }}>
                    <div>
                      <p style={{ fontSize: 13, color: '#F2F7F3', fontWeight: 700, margin: 0 }}>{c.name}</p>
                      <p style={{ fontSize: 10, color: '#7d8a99', margin: 0, wordBreak: 'break-all' }}>{c.url}</p>
                    </div>
                    <button onClick={() => removerCamera(c.id)} style={{ ...btnStyle(false), padding: '4px 10px', flexShrink: 0 }}>Remover</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 11, color: '#94a3b8', fontWeight: 600 };
const inputStyle: React.CSSProperties = {
  background: '#06100A', color: '#F2F7F3', border: '1px solid #16301F',
  borderRadius: 8, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box',
};
const selectStyle: React.CSSProperties = {
  flex: 1, background: '#0B1A10', color: '#F2F7F3',
  border: '1px solid #16301F', borderRadius: 8, padding: '6px 8px', fontSize: 13,
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    border: active ? 'none' : '1px solid #16301F',
    cursor: 'pointer',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 12,
    fontWeight: 700,
    fontFamily: 'inherit',
    background: active ? '#9EF01A' : '#0B1A10',
    color: active ? '#06100A' : '#8FA396',
  };
}

function btnStyle(primary: boolean): React.CSSProperties {
  return {
    border: primary ? 'none' : '1px solid #16301F',
    cursor: 'pointer',
    borderRadius: 999,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'inherit',
    background: primary ? '#9EF01A' : '#0B1A10',
    color: primary ? '#06100A' : '#8FA396',
  };
}
