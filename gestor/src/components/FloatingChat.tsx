import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Minus, GripHorizontal, Maximize2, Minimize2, Camera, Paperclip, RefreshCw, Bot, Zap } from 'lucide-react';
import miarSimbolo from '@/assets/miarai2.webp';
import miarIcon from '@/assets/miar-icon.png';
import miaAvatar from '@/assets/miar-avatar.png';

interface FloatingChatProps {
  getToken: () => string;
  ownerName?: string;
  companyName?: string;
  endpoint?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  imageBase64?: string;
  imageMimeType?: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

function getInitialChatSize(isMobile: boolean) {
  return {
    w: isMobile ? Math.min(window.innerWidth - 20, 420) : 360,
    h: isMobile ? Math.min(window.innerHeight * 0.72, 520) : 480,
  };
}

const CLOSED_BUTTON_SIZE = { w: 64, h: 64 };

function getInitialChatPosition(width: number, height: number, isMobile: boolean) {
  const maxX = Math.max(12, window.innerWidth - width - 12);
  const maxY = Math.max(12, window.innerHeight - height - 12);
  const x = isMobile ? clamp((window.innerWidth - width) / 2, 12, maxX) : maxX;
  const y = isMobile ? clamp(window.innerHeight - height - 18, 12, maxY) : maxY;
  return { x, y };
}

export function FloatingChat({ getToken, ownerName, companyName, endpoint = '/api/mia' }: FloatingChatProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('miar-chat-dismissed') === '1');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ base64: string; mimeType: string; previewUrl: string } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [size, setSize] = useState(() => getInitialChatSize(isMobile));
  const [position, setPosition] = useState(() => getInitialChatPosition(CLOSED_BUTTON_SIZE.w, CLOSED_BUTTON_SIZE.h, isMobile));
  const normalLayoutRef = useRef<{ size: typeof size; position: typeof position } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; startW: number; startH: number; startXPos: number; startYPos: number; moved: boolean } | null>(null);
  const clickSuppressRef = useRef(false);

  useEffect(() => {
    const handler = () => setDismissed(localStorage.getItem('miar-chat-dismissed') === '1');
    window.addEventListener('miar-chat-visibility-changed', handler);
    return () => window.removeEventListener('miar-chat-visibility-changed', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (maximized) {
      setSize({ w: Math.max(300, window.innerWidth - 24), h: Math.max(320, window.innerHeight - 24) });
      setPosition({ x: 12, y: 12 });
      return;
    }

    setSize((prev) => ({
      w: clamp(prev.w, 280, Math.max(280, window.innerWidth - 24)),
      h: clamp(prev.h, 300, Math.max(300, window.innerHeight - 24)),
    }));
    setPosition((prev) => ({
      x: clamp(prev.x, 12, Math.max(12, window.innerWidth - size.w - 12)),
      y: clamp(prev.y, 12, Math.max(12, window.innerHeight - size.h - 12)),
    }));
  }, [isMobile, maximized, open, size.h, size.w]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    if (isMobile && open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobile, open]);

  const dismiss = useCallback(() => {
    localStorage.setItem('miar-chat-dismissed', '1');
    setDismissed(true);
    setOpen(false);
  }, []);

  const handleOpen = useCallback(() => {
    if (clickSuppressRef.current) {
      clickSuppressRef.current = false;
      return;
    }
    setOpen(true);
    setMinimized(false);
    setMaximized(false);
  }, []);

  const toggleMaximized = useCallback(() => {
    if (maximized) {
      const previous = normalLayoutRef.current;
      if (previous) {
        setSize(previous.size);
        setPosition(previous.position);
      }
      setMaximized(false);
      return;
    }

    normalLayoutRef.current = { size, position };
    setMaximized(true);
  }, [maximized, position, size]);

  const onDragStart = useCallback((e: React.PointerEvent<HTMLButtonElement | HTMLDivElement>) => {
    if (maximized) return;
    e.preventDefault();
    dragRef.current = {
      mode: 'move',
      startX: e.clientX,
      startY: e.clientY,
      startW: size.w,
      startH: size.h,
      startXPos: position.x,
      startYPos: position.y,
      moved: false,
    };

    const onMove = (ev: PointerEvent) => {
      const current = dragRef.current;
      if (!current || current.mode !== 'move') return;
      const dx = ev.clientX - current.startX;
      const dy = ev.clientY - current.startY;
      if (!current.moved && Math.hypot(dx, dy) > 6) {
        current.moved = true;
      }

      const boundsWidth = open ? size.w : CLOSED_BUTTON_SIZE.w;
      const boundsHeight = open ? size.h : CLOSED_BUTTON_SIZE.h;
      const nextX = clamp(current.startXPos + dx, 12, Math.max(12, window.innerWidth - boundsWidth - 12));
      const nextY = clamp(current.startYPos + dy, 12, Math.max(12, window.innerHeight - boundsHeight - 12));
      setPosition({ x: nextX, y: nextY });
    };

    const onUp = () => {
      const current = dragRef.current;
      if (current?.mode === 'move' && current.moved) {
        clickSuppressRef.current = true;
      }

      if (current?.mode === 'move') {
        const snapTop = position.y < window.innerHeight * 0.22;
        if (snapTop) setPosition((prev) => ({ ...prev, y: 18 }));
      }

      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [maximized, open, position.y, size.h, size.w]);

  const onResizeStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (maximized) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      mode: 'resize',
      startX: e.clientX,
      startY: e.clientY,
      startW: size.w,
      startH: size.h,
      startXPos: position.x,
      startYPos: position.y,
      moved: false,
    };

    const onMove = (ev: PointerEvent) => {
      const current = dragRef.current;
      if (!current || current.mode !== 'resize') return;
      const deltaX = ev.clientX - current.startX;
      const nextW = clamp(current.startW + deltaX, 280, Math.max(280, window.innerWidth - current.startXPos - 12));
      const nextH = clamp(current.startH + (ev.clientY - current.startY), 300, Math.max(300, window.innerHeight - current.startYPos - 12));
      setSize({ w: nextW, h: nextH });
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [maximized, position.x, position.y, size.h, size.w]);

  const fileToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const handleFileSelected = useCallback(async (file: File) => {
    const base64 = await fileToBase64(file);
    setPendingImage({ base64, mimeType: file.type || 'image/jpeg', previewUrl: URL.createObjectURL(file) });
  }, []);

  const toggleCamera = useCallback(async () => {
    if (cameraOpen) {
      cameraStream?.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
      setCameraOpen(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Sua plataforma não suporta câmera neste navegador.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cameraFacing }, audio: false });
      setCameraStream(stream);
      setCameraOpen(true);
    } catch {
      setError('Não foi possível abrir a câmera.');
    }
  }, [cameraOpen, cameraStream, cameraFacing]);

  const switchCameraFacing = useCallback(async () => {
    const next = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(next);
    if (!cameraOpen) return;
    cameraStream?.getTracks().forEach((t) => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next }, audio: false });
      setCameraStream(stream);
    } catch {
      setError('Não foi possível trocar de câmera neste aparelho.');
    }
  }, [cameraFacing, cameraOpen, cameraStream]);

  useEffect(() => {
    if (cameraOpen && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraOpen, cameraStream]);

  const captureCameraFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      void fileToBase64(blob).then((base64) => {
        setPendingImage({ base64, mimeType: 'image/jpeg', previewUrl: URL.createObjectURL(blob) });
      });
    }, 'image/jpeg', 0.9);
    cameraStream?.getTracks().forEach((t) => t.stop());
    setCameraStream(null);
    setCameraOpen(false);
  }, [cameraStream]);

  const send = useCallback(async () => {
    const text = input.trim();
    if ((!text && !pendingImage) || sending) return;
    setInput('');
    setError(null);
    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: text || '(imagem enviada)', imageBase64: pendingImage?.base64, imageMimeType: pendingImage?.mimeType },
    ];
    setMessages(nextMessages);
    setPendingImage(null);
    setSending(true);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ messages: nextMessages, ownerName, companyName }),
      });
      const responseText = await response.text();
      let data: { error?: string; message?: string } = {};
      if (responseText.trim()) {
        try {
          data = JSON.parse(responseText) as { error?: string; message?: string };
        } catch {
          data = { error: 'A MIAR retornou uma resposta inválida.' };
        }
      }
      if (!response.ok) {
        setError(response.status === 403
          ? 'Chat com a MIAR ainda não foi liberado pelo gestor pro seu cargo.'
          : (data.error ?? 'Erro ao falar com a MIAR'));
        return;
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: data.message ?? 'Não recebi uma resposta da MIAR.' }]);
    } catch (err: any) {
      setError(err.message ?? 'Erro de conexão');
    } finally {
      setSending(false);
    }
  }, [input, pendingImage, messages, sending, getToken, ownerName, companyName, endpoint]);

  if (dismissed) return null;

  if (!open) {
    return (
      <div
        className="fixed z-50 flex items-center gap-1.5 group"
        style={{ left: position.x, top: position.y, touchAction: 'none' }}
      >
        <button
          onPointerDown={onDragStart}
          onClick={handleOpen}
          style={{ touchAction: 'none' }}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#0B1A10] p-1 shadow-[0_0_25px_rgba(255,195,0,0.35)] ring-2 ring-[#008000] transition-all duration-300 hover:scale-110 hover:shadow-[0_0_35px_rgba(255,195,0,0.6)] hover:ring-amber-300 active:scale-95"
          aria-label="Abrir MIAR Ária IA"
        >
          {/* Glowing Pulse Ring */}
          <span className="absolute -inset-1 animate-pulse rounded-full bg-gradient-to-r from-[#008000] via-amber-400 to-[#16301F] opacity-35 blur-md" />

          {/* Avatar / Logo Box */}
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#06100A] border border-[#008000]/40">
            <img
              src={miarSimbolo || miarIcon || miaAvatar}
              alt="MIAR Ária"
              className="h-full w-full object-contain p-1.5 transition-transform duration-300 group-hover:scale-110"
              onError={(e) => {
                const target = e.currentTarget;
                target.src = miaAvatar;
              }}
            />
          </div>

          {/* Bot Badge */}
          <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#008000] text-[#F2F7F3] shadow-lg ring-2 ring-[#0B1A10]">
            <Bot className="h-3 w-3" />
          </div>

          {/* Online Indicator Dot */}
          <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-[#0B1A10]" />
        </button>

        {/* Close Button */}
        <button
          onClick={dismiss}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-700/80 bg-[#0B1A10]/95 text-slate-400 shadow-md backdrop-blur-md transition hover:bg-rose-500 hover:text-white"
          aria-label="Fechar chat da MIAR"
          title="Fechar — reative depois nas configurações"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (minimized && !isMobile) {
    return (
      <button
        onPointerDown={onDragStart}
        onClick={() => setMinimized(false)}
        className="fixed z-50 flex items-center gap-2.5 rounded-full border border-[#008000]/40 bg-[#0B1A10]/95 px-3.5 py-2 text-sm text-slate-100 shadow-[0_0_20px_rgba(255,195,0,0.25)] backdrop-blur-md transition hover:scale-105 hover:border-[#008000]"
        style={{ left: position.x, top: position.y }}
      >
        <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#06100A] border border-[#008000]/40 overflow-hidden">
          <img src={miarSimbolo || miarIcon} alt="MIAR" className="h-full w-full object-contain p-0.5" />
        </div>
        <span className="font-semibold text-[#008000] flex items-center gap-1.5 text-xs tracking-wide">
          <Bot className="h-3.5 w-3.5" /> MIAR Ária
        </span>
      </button>
    );
  }

  return (
    <div
      className="miar-floating-chat fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-[#008000]/30 bg-[#06100A] shadow-[0_0_35px_rgba(0,0,0,0.8)] backdrop-blur-xl"
      style={{
        width: maximized ? Math.max(300, window.innerWidth - 24) : size.w,
        height: maximized ? Math.max(320, window.innerHeight - 24) : size.h,
        left: maximized ? 12 : position.x,
        top: maximized ? 12 : position.y,
      }}
    >
      {/* Header */}
      <div
        onPointerDown={onDragStart}
        className="miar-floating-chat-header absolute left-0 right-0 top-0 z-10 flex cursor-grab items-center justify-between border-b border-[#008000]/20 bg-gradient-to-r from-[#0B1A10] via-[#002855] to-[#0B1A10] px-3.5 py-2.5 active:cursor-grabbing"
      >
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#06100A] border border-[#008000]/40 p-0.5">
            <img src={miarSimbolo || miarIcon} alt="MIAR" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-slate-100 tracking-wide">MIAR Ária</span>
              <span className="rounded-full bg-[#008000]/20 border border-[#008000]/30 px-1.5 py-0.2 text-[10px] font-semibold text-[#008000] flex items-center gap-0.5">
                <Bot className="h-2.5 w-2.5" /> IA
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Inteligência Operacional</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setMinimized((prev) => !prev)}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Minimizar"
            title="Minimizar"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={toggleMaximized}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label={maximized ? 'Restaurar' : 'Maximizar'}
            title={maximized ? 'Restaurar' : 'Maximizar'}
          >
            {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setOpen(false)}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-rose-400"
            aria-label="Fechar"
            title="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col pt-14">
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 py-3">
          {messages.length === 0 && (
            <div className="space-y-3">
              <div className="rounded-xl border border-[#008000]/20 bg-[#0B1A10]/60 p-3 text-xs text-slate-300">
                <p className="font-medium text-[#008000] flex items-center gap-1.5 mb-1">
                  <Bot className="h-3.5 w-3.5" /> Olá! Sou a MIAR Ária
                </p>
                <p>Estou pronta para responder dúvidas operacionais, analisar seu estoque, receitas ou configurações no sistema.</p>
              </div>
              <a
                href="https://wa.me/5567993089698"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors"
              >
                Falar com o suporte MIAR no WhatsApp — (67) 99308-9698
              </a>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`miar-floating-bubble max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-md ${
                m.role === 'user'
                  ? 'bg-gradient-to-r from-amber-400 to-[#008000] text-[#F2F7F3] font-medium'
                  : 'bg-[#0B1A10] border border-slate-700/60 text-slate-100'
              }`}>
                {m.imageBase64 && (
                  <img
                    src={`data:${m.imageMimeType ?? 'image/jpeg'};base64,${m.imageBase64}`}
                    alt="Imagem enviada"
                    className="mb-1.5 max-h-40 rounded-lg object-cover"
                  />
                )}
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-xs text-[#008000]">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" /> MIAR Ária está pensando...
            </div>
          )}
          {error && <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">{error}</p>}
        </div>

        {pendingImage && (
          <div className="flex items-center gap-2 border-t border-slate-800 bg-[#0B1A10]/80 px-3 py-2">
            <img src={pendingImage.previewUrl} alt="Anexo pronto para enviar" className="h-12 w-12 rounded-lg object-cover border border-[#008000]/40" />
            <span className="flex-1 text-xs text-slate-300">Imagem anexada — pronta para envio</span>
            <button type="button" onClick={() => setPendingImage(null)} className="rounded p-1 text-slate-400 hover:bg-slate-800" aria-label="Remover imagem">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="miar-floating-composer mt-auto flex shrink-0 items-end gap-2 border-t border-[#008000]/20 bg-[#0B1A10]/50 p-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFileSelected(f); e.target.value = ''; }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-[#0B1A10] hover:text-[#008000] transition-colors"
            aria-label="Anexar imagem"
            title="Anexar imagem"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void toggleCamera()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-[#0B1A10] hover:text-[#008000] transition-colors"
            aria-label="Abrir câmera"
            title="Abrir câmera"
          >
            <Camera className="h-4 w-4" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder="Pergunte à MIAR Ária..."
            rows={1}
            className="max-h-32 min-h-10 flex-1 resize-y rounded-2xl border border-slate-700/80 bg-[#06100A] px-4 py-2 text-sm text-slate-100 outline-none focus:border-[#008000]"
          />
          <button
            onClick={() => void send()}
            disabled={sending || (!input.trim() && !pendingImage)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#008000] text-[#F2F7F3] font-bold disabled:opacity-40 hover:bg-amber-400 transition-colors shadow-md"
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {cameraOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#008000]/30 bg-[#0B1A10] p-3 shadow-2xl">
            <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl bg-black" />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => void switchCameraFacing()} className="rounded-full bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700">
                <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
                {cameraFacing === 'user' ? 'câmera externa' : 'câmera interna'}
              </button>
              <button type="button" onClick={captureCameraFrame} className="rounded-full bg-[#008000] px-4 py-2 text-xs font-bold text-[#F2F7F3] hover:bg-amber-400">
                capturar
              </button>
              <button type="button" onClick={() => void toggleCamera()} className="rounded-full bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700">
                fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        onPointerDown={onResizeStart}
        className="absolute bottom-0 right-0 z-10 flex h-7 w-7 cursor-nwse-resize items-center justify-center rounded-tl-lg bg-[#0B1A10] text-[#008000] hover:bg-slate-800"
        title="Arraste para redimensionar"
      >
        <GripHorizontal className="h-3.5 w-3.5 rotate-45" />
      </div>
    </div>
  );
}

