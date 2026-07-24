import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Hash, Lock, MessageCircle, Plus, Users, UsersRound, UserPlus, UserMinus, Send, Briefcase,
  Paperclip, X, Reply, Mic, Square, Bell, File as FileIcon, Image as ImageIcon,
  Play, Pause, ArrowLeft,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { registerPWA, requestNotificationPermission, notify } from "@/lib/pwa";


export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
});

type Channel = {
  id: string; name: string; topic: string | null;
  type: "public" | "private" | "dm" | "client";
  client_id: string | null;
};
type Member = { id: string; user_id: string; role: "admin" | "member"; profile?: Profile };
type Profile = { id: string; full_name: string; email: string; avatar_url: string | null };
type Task = { id: string; title: string; status: string };
type Client = { id: string; name: string };

function handleFromName(name?: string | null) {
  if (!name) return "user";
  return name.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, "") || "user";
}
function clientHandle(name?: string | null) {
  if (!name) return "cliente";
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "cliente";
}
function renderWithMentions(text: string) {
  const parts = text.split(/(@[\w]+|#[\w-]+)/g);
  return parts.map((p, i) => {
    if (/^@[\w]+$/.test(p)) return <span key={i} className="text-primary font-medium bg-primary/10 rounded px-0.5">{p}</span>;
    if (/^#[\w-]+$/.test(p)) return <span key={i} className="text-blue-600 font-medium bg-blue-500/10 rounded px-0.5">{p}</span>;
    return <span key={i}>{p}</span>;
  });
}
type Message = {
  id: string; channel_id: string; author_id: string | null; body: string | null;
  task_id: string | null; parent_id: string | null;
  attachment_url: string | null; attachment_type: string | null;
  attachment_name: string | null; attachment_size: number | null;
  attachment_kind: string | null;
  created_at: string; edited_at: string | null;
  author?: Profile; task?: Task; parent?: Message;
};

function initials(name?: string | null) {
  if (!name) return "??";
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function ChatPage() {
  const { user, hasRole } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const active = channels.find((c) => c.id === activeId) ?? null;

  async function loadChannels() {
    const { data } = await supabase
      .from("channels").select("*").order("type").order("name");
    setChannels((data ?? []) as Channel[]);
    if (!activeId && data && data.length) setActiveId(data[0].id);
  }
  async function loadProfiles() {
    const { data } = await supabase.from("profiles").select("id, full_name, email, avatar_url");
    setProfiles((data ?? []) as Profile[]);
  }

  useEffect(() => { loadChannels(); loadProfiles(); }, []);

  // Realtime: channels + members changes affect visible list
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("chat-meta")
      .on("postgres_changes", { event: "*", schema: "public", table: "channels" }, () => loadChannels())
      .on("postgres_changes", { event: "*", schema: "public", table: "channel_members", filter: `user_id=eq.${user.id}` }, () => loadChannels())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const grouped = useMemo(() => ({
    public: channels.filter((c) => c.type === "public"),
    client: channels.filter((c) => c.type === "client"),
    private: channels.filter((c) => c.type === "private"),
    dm: channels.filter((c) => c.type === "dm"),
  }), [channels]);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] md:h-[calc(100vh-3.5rem)] bg-background -mb-[calc(env(safe-area-inset-bottom)+3.75rem)] md:mb-0">
      {/* Channel sidebar */}
      <aside
        className={cn(
          "w-full md:w-64 shrink-0 border-r bg-card text-foreground flex-col md:flex",
          active ? "hidden md:flex" : "flex"
        )}
      >
        <div className="p-3 border-b border-border flex items-center justify-between">
          <div className="font-semibold text-sm">Mensagens</div>
          <NewChannelDialog onCreated={(id) => { loadChannels(); setActiveId(id); }} />
        </div>
        <ScrollArea className="flex-1">
          <ChannelGroup label="Canais" icon={Hash} items={grouped.public} activeId={activeId} onSelect={setActiveId} />
          <ChannelGroup label="Clientes" icon={Briefcase} items={grouped.client} activeId={activeId} onSelect={setActiveId} />
          <ChannelGroup label="Privados" icon={Lock} items={grouped.private} activeId={activeId} onSelect={setActiveId} />
          <div className="px-3 pt-3 pb-1 flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Mensagens Diretas</div>
            <NewDMDialog profiles={profiles.filter((p) => p.id !== user?.id)} onCreated={(id) => { loadChannels(); setActiveId(id); }} />
          </div>
          <div className="pb-3">
            {grouped.dm.map((c) => (
              <DMRow key={c.id} channel={c} activeId={activeId} onSelect={setActiveId} meId={user?.id} profiles={profiles} />
            ))}
            {grouped.dm.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Nenhuma DM ainda</div>
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Main pane */}
      <section className={cn("flex-1 min-w-0 flex-col", active ? "flex" : "hidden md:flex")}>
        {active ? (
          <ChannelView channel={active} profiles={profiles} isAgencyAdmin={hasRole("admin")} onBack={() => setActiveId(null)} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Selecione um canal
          </div>
        )}
      </section>
    </div>
  );
}


function ChannelGroup({
  label, icon: Icon, items, activeId, onSelect,
}: {
  label: string; icon: any; items: Channel[]; activeId: string | null; onSelect: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="pt-3">
      <div className="px-3 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      {items.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent text-left",
            activeId === c.id && "bg-accent text-accent-foreground"
          )}
        >
          <Icon className="h-3.5 w-3.5 opacity-70 shrink-0" />
          <span className="truncate">{c.name}</span>
        </button>
      ))}
    </div>
  );
}

function DMRow({
  channel, activeId, onSelect, meId, profiles,
}: {
  channel: Channel; activeId: string | null; onSelect: (id: string) => void;
  meId?: string; profiles: Profile[];
}) {
  const [otherName, setOtherName] = useState<string>(channel.name);
  const [otherAvatar, setOtherAvatar] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("channel_members").select("user_id").eq("channel_id", channel.id);
      const other = (data ?? []).find((m) => m.user_id !== meId);
      if (other) {
        const p = profiles.find((x) => x.id === other.user_id);
        if (p) { setOtherName(p.full_name || p.email); setOtherAvatar(p.avatar_url); }
      }
    })();
  }, [channel.id, meId, profiles]);
  return (
    <button
      onClick={() => onSelect(channel.id)}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent text-left",
        activeId === channel.id && "bg-accent text-accent-foreground"
      )}
    >
      <div className="h-5 w-5 rounded-full bg-primary/30 text-[10px] flex items-center justify-center shrink-0 overflow-hidden">
        {otherAvatar ? <img src={otherAvatar} alt="" className="h-full w-full object-cover" /> : initials(otherName)}
      </div>
      <span className="truncate">{otherName}</span>
    </button>
  );
}

/* -------- New channel / DM dialogs -------- */

function NewChannelDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [type, setType] = useState<"public" | "private">("public");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim() || !user) return;
    setBusy(true);
    const clean = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const { data, error } = await supabase.from("channels")
      .insert({ name: clean, topic: topic || null, type, created_by: user.id })
      .select("id").single();
    if (error) { toast.error(error.message); setBusy(false); return; }
    // add self as admin
    await supabase.from("channel_members").insert({ channel_id: data!.id, user_id: user.id, role: "admin" });
    toast.success("Canal criado");
    setOpen(false); setName(""); setTopic(""); setType("public"); setBusy(false);
    onCreated(data!.id);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo canal</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="nome-do-canal" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Tópico (opcional)" value={topic} onChange={(e) => setTopic(e.target.value)} />
          <Select value={type} onValueChange={(v) => setType(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Público — todos entram automaticamente</SelectItem>
              <SelectItem value="private">Privado — apenas convidados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewDMDialog({ profiles, onCreated }: { profiles: Profile[]; onCreated: (id: string) => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string>("");

  async function submit() {
    if (!target || !user) return;
    // check existing DM containing both
    const { data: mine } = await supabase.from("channel_members")
      .select("channel_id, channels!inner(id,type)").eq("user_id", user.id);
    const dmIds = (mine ?? []).filter((m: any) => m.channels?.type === "dm").map((m: any) => m.channel_id);
    if (dmIds.length) {
      const { data: theirs } = await supabase.from("channel_members")
        .select("channel_id").in("channel_id", dmIds).eq("user_id", target);
      if (theirs && theirs.length) {
        onCreated(theirs[0].channel_id);
        setOpen(false);
        return;
      }
    }
    const other = profiles.find((p) => p.id === target);
    const { data: ch, error } = await supabase.from("channels")
      .insert({ name: `dm-${other?.full_name || "user"}`, type: "dm", created_by: user.id }).select("id").single();
    if (error) { toast.error(error.message); return; }
    await supabase.from("channel_members").insert([
      { channel_id: ch!.id, user_id: user.id, role: "admin" },
      { channel_id: ch!.id, user_id: target, role: "member" },
    ]);
    onCreated(ch!.id);
    setOpen(false); setTarget("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova mensagem direta</DialogTitle></DialogHeader>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger><SelectValue placeholder="Escolha alguém da equipe" /></SelectTrigger>
          <SelectContent>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter><Button onClick={submit} disabled={!target}>Abrir conversa</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------- Channel view -------- */

function ChannelView({ channel, profiles, isAgencyAdmin, onBack }: { channel: Channel; profiles: Profile[]; isAgencyAdmin: boolean; onBack?: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [text, setText] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [attachTaskId, setAttachTaskId] = useState<string | null>(null);
  const [mention, setMention] = useState<{ type: "@" | "#" | "/"; query: string; start: number } | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const messagesRef = useRef<Message[]>([]);

  const meIsAdmin = isAgencyAdmin || members.find((m) => m.user_id === user?.id)?.role === "admin";

  async function loadMessages() {
    const { data } = await supabase.from("messages").select("*")
      .eq("channel_id", channel.id).order("created_at", { ascending: true }).limit(200);
    const list = (data ?? []) as Message[];
    const taskIds = Array.from(new Set(list.map((m) => m.task_id).filter(Boolean))) as string[];
    let tmap = new Map<string, Task>();
    if (taskIds.length) {
      const { data: ts } = await supabase.from("tasks").select("id,title,status").in("id", taskIds);
      (ts ?? []).forEach((t: any) => tmap.set(t.id, t));
    }
    const byId = new Map(list.map((m) => [m.id, m]));
    const enriched = list.map((m) => ({
      ...m,
      author: profiles.find((p) => p.id === m.author_id) || undefined,
      task: m.task_id ? tmap.get(m.task_id) : undefined,
      parent: m.parent_id ? byId.get(m.parent_id) : undefined,
    }));
    enriched.forEach((m) => {
      if (m.parent) m.parent.author = profiles.find((p) => p.id === m.parent!.author_id) || m.parent.author;
    });
    messagesRef.current = enriched;
    setMessages(enriched);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
  }
  async function loadMembers() {
    const { data } = await supabase.from("channel_members").select("*").eq("channel_id", channel.id);
    const rows = (data ?? []) as Member[];
    setMembers(rows.map((m) => ({ ...m, profile: profiles.find((p) => p.id === m.user_id) })));
  }
  async function loadTasks() {
    let q = supabase.from("tasks").select("id,title,status").order("created_at", { ascending: false }).limit(50);
    if (channel.client_id) q = q.eq("client_id", channel.client_id);
    const { data } = await q;
    setTasks((data ?? []) as Task[]);
  }
  async function loadClients() {
    const { data } = await supabase.from("clients").select("id, name").order("name");
    setClients((data ?? []) as Client[]);
  }

  useEffect(() => {
    loadMessages(); loadMembers(); loadTasks(); loadClients();
    setReplyTo(null); setPendingFile(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id, profiles.length]);

  useEffect(() => {
    const ch = supabase.channel(`msg-${channel.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channel.id}` },
        async (payload) => {
          await loadMessages();
          const m: any = payload.new;
          if (m.author_id && m.author_id !== user?.id) {
            const author = profiles.find((p) => p.id === m.author_id);
            const authorName = author?.full_name || author?.email || "Alguém";
            const preview = m.body || (m.attachment_kind === "audio" ? "🎤 Áudio" : m.attachment_url ? "📎 Anexo" : "");
            const hidden = typeof document !== "undefined" && document.hidden;
            const label = channel.type === "dm" ? authorName : `#${channel.name} · ${authorName}`;
            if (hidden) notify(label, preview, "/chat", `ch-${channel.id}`);
          }
        })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "channel_members", filter: `channel_id=eq.${channel.id}` },
        () => loadMembers())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id, user?.id, profiles.length]);

  async function uploadBlob(blob: Blob, filename: string, kind: "file" | "audio" | "image"): Promise<{
    url: string; type: string; name: string; size: number; kind: string;
  } | null> {
    if (!user) return null;
    const contentType = blob.type || "application/octet-stream";
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) { toast.error("Sessão expirada"); return null; }
      const resp = await fetch("/api/r2-upload", {
        method: "POST",
        headers: {
          "Content-Type": contentType,
          "Authorization": `Bearer ${token}`,
          "x-folder": `chat/${channel.id}`,
          "x-filename": filename,
        },
        body: blob,
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        toast.error(`Falha no upload (${resp.status}) ${txt.slice(0, 160)}`);
        return null;
      }
      const { url } = await resp.json();
      return { url, type: contentType, name: filename, size: blob.size, kind };
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar arquivo");
      return null;
    }
  }


  async function send() {
    if (!user) return;
    if (!text.trim() && !pendingFile) return;
    const body = text.trim();
    const attach = attachTaskId; const parent = replyTo?.id ?? null; const file = pendingFile;
    setText(""); setAttachTaskId(null); setReplyTo(null); setPendingFile(null);

    let att: any = null;
    if (file) {
      setUploading(true);
      const kind = file.type.startsWith("image/") ? "image" : "file";
      att = await uploadBlob(file, file.name, kind);
      setUploading(false);
      if (!att) { setPendingFile(file); return; }
    }
    const { error } = await supabase.from("messages").insert({
      channel_id: channel.id, author_id: user.id,
      body: body || null, task_id: attach, parent_id: parent,
      attachment_url: att?.url ?? null, attachment_type: att?.type ?? null,
      attachment_name: att?.name ?? null, attachment_size: att?.size ?? null,
      attachment_kind: att?.kind ?? null,
    });
    if (error) { toast.error(error.message); setText(body); }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const filename = `audio-${Date.now()}.webm`;
        setUploading(true);
        const att = await uploadBlob(blob, filename, "audio");
        setUploading(false);
        if (!att || !user) return;
        await supabase.from("messages").insert({
          channel_id: channel.id, author_id: user.id,
          body: null, parent_id: replyTo?.id ?? null,
          attachment_url: att.url, attachment_type: att.type,
          attachment_name: att.name, attachment_size: att.size, attachment_kind: "audio",
        });
        setReplyTo(null);
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch (e: any) {
      toast.error("Não foi possível acessar o microfone");
    }
  }
  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  async function enableNotifications() {
    await registerPWA();
    const p = await requestNotificationPermission();
    setNotifPerm(p);
    if (p === "granted") toast.success("Notificações ativadas");
    else toast.error("Permissão negada. Ative nas configurações do navegador.");
  }

  const ctype: string = channel.type;
  const Icon = ctype === "client" ? Briefcase
    : ctype === "squad" ? UsersRound
    : ctype === "dm" ? MessageCircle
    : ctype === "private" ? Lock : Hash;

  return (
    <>
      <header className="h-14 border-b flex items-center gap-2 px-3 sm:px-4 shrink-0">
        {onBack && (
          <Button variant="ghost" size="icon" className="md:hidden -ml-1 h-8 w-8" onClick={onBack} aria-label="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <Icon className="h-4 w-4 text-muted-foreground" />

        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{channel.name}</div>
          {channel.topic && <div className="text-xs text-muted-foreground truncate">{channel.topic}</div>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {notifPerm !== "granted" && (
            <Button variant="outline" size="sm" onClick={enableNotifications} title="Ativar notificações">
              <Bell className="h-4 w-4 mr-1" /> Notificações
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowMembers(true)}>
            <Users className="h-4 w-4 mr-1" /> {members.length}
          </Button>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-16">Sem mensagens. Diga oi 👋</div>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const grouped = prev && prev.author_id === m.author_id && !m.parent_id
              && (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 15 * 60_000);
            return (
              <div key={m.id} className={cn("group flex gap-3", grouped ? "pl-11 mt-0.5" : "mt-4")}>
                {!grouped && (
                  <div className="h-8 w-8 rounded-md bg-primary/20 text-primary text-xs font-semibold flex items-center justify-center shrink-0 overflow-hidden">
                    {m.author?.avatar_url ? (
                      <img src={m.author.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      initials(m.author?.full_name || m.author?.email)
                    )}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {!grouped && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold">{m.author?.full_name || m.author?.email || "—"}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(m.created_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                      </span>
                    </div>
                  )}
                  {m.parent && (
                    <a href={`#msg-${m.parent.id}`} className="block mb-1 border-l-2 border-primary/50 pl-2 text-xs text-muted-foreground hover:text-foreground">
                      <span className="font-medium">{m.parent.author?.full_name || m.parent.author?.email || "—"}</span>{" "}
                      <span className="line-clamp-1">{m.parent.body || (m.parent.attachment_kind === "audio" ? "🎤 Áudio" : "📎 Anexo")}</span>
                    </a>
                  )}
                  <div id={`msg-${m.id}`} className="text-sm whitespace-pre-wrap break-words">{m.body ? renderWithMentions(m.body) : null}</div>
                  {m.attachment_url && m.attachment_kind === "image" && (
                    <button
                      type="button"
                      onClick={() => setLightbox({ url: m.attachment_url!, name: m.attachment_name || "imagem" })}
                      className="block mt-1"
                    >
                      <img
                        src={m.attachment_url}
                        alt={m.attachment_name || "imagem"}
                        loading="eager"
                        decoding="async"
                        fetchPriority="low"
                        className="max-h-64 rounded-md border cursor-zoom-in hover:opacity-90 transition"
                      />
                    </button>
                  )}
                  {m.attachment_url && m.attachment_kind === "audio" && (
                    <AudioPlayer src={m.attachment_url} />
                  )}


                  {m.attachment_url && m.attachment_kind === "file" && (
                    <a href={m.attachment_url} target="_blank" rel="noreferrer"
                       className="mt-1 inline-flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1 text-xs hover:bg-muted">
                      <FileIcon className="h-3 w-3" />
                      <span className="font-medium">{m.attachment_name}</span>
                      {m.attachment_size ? <span className="text-muted-foreground">({Math.round(m.attachment_size/1024)} KB)</span> : null}
                    </a>
                  )}
                  {m.task && (
                    <div className="mt-1 inline-flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1 text-xs">
                      <Paperclip className="h-3 w-3" />
                      <span className="font-medium">Tarefa:</span> {m.task.title}
                      <Badge variant="secondary" className="text-[10px]">{m.task.status}</Badge>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setReplyTo(m)}
                  className="opacity-0 group-hover:opacity-100 self-start text-muted-foreground hover:text-foreground p-1"
                  title="Responder"
                >
                  <Reply className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t px-3 pt-3 shrink-0 space-y-2 pb-[calc(env(safe-area-inset-bottom)+5rem)] md:pb-3">
        {replyTo && (
          <div className="flex items-center gap-2 text-xs rounded-md border bg-muted/40 px-2 py-1">
            <Reply className="h-3 w-3" />
            <span>Respondendo a <b>{replyTo.author?.full_name || replyTo.author?.email || "—"}</b>:</span>
            <span className="truncate text-muted-foreground max-w-md">
              {replyTo.body || (replyTo.attachment_kind === "audio" ? "🎤 Áudio" : "📎 Anexo")}
            </span>
            <button className="ml-auto" onClick={() => setReplyTo(null)}><X className="h-3 w-3" /></button>
          </div>
        )}
        {pendingFile && (
          <div className="flex items-center gap-2 text-xs rounded-md border bg-muted/40 px-2 py-1">
            {pendingFile.type.startsWith("image/") ? <ImageIcon className="h-3 w-3" /> : <FileIcon className="h-3 w-3" />}
            <span className="truncate">{pendingFile.name}</span>
            <span className="text-muted-foreground">({Math.round(pendingFile.size/1024)} KB)</span>
            <button className="ml-auto" onClick={() => setPendingFile(null)}><X className="h-3 w-3" /></button>
          </div>
        )}
        {attachTaskId && (
          <div className="inline-flex items-center gap-2 text-xs rounded-md border bg-muted/40 px-2 py-1">
            <Paperclip className="h-3 w-3" />
            {tasks.find((t) => t.id === attachTaskId)?.title}
            <button onClick={() => setAttachTaskId(null)}><X className="h-3 w-3" /></button>
          </div>
        )}
        <div className="flex items-end gap-1.5">
          <input
            ref={fileInputRef} type="file" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setPendingFile(f); e.currentTarget.value = ""; }}
          />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => fileInputRef.current?.click()} title="Anexar arquivo" disabled={recording}>
            <Paperclip className="h-3.5 w-3.5" />
          </Button>
          {!recording ? (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={startRecording} title="Gravar áudio">
              <Mic className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button variant="destructive" size="icon" className="h-8 w-8 shrink-0" onClick={stopRecording} title="Parar gravação">
              <Square className="h-3.5 w-3.5" />
            </Button>
          )}
          <div className="relative flex-1">
            {mention && (() => {
              const q = mention.query.toLowerCase();
              type Opt = { id: string; label: string; handle: string; sub?: string };
              const opts: Opt[] = mention.type === "@"
                ? profiles.filter((p) => (p.full_name || p.email).toLowerCase().includes(q)).slice(0, 6)
                    .map((p) => ({ id: p.id, label: p.full_name || p.email, handle: handleFromName(p.full_name || p.email) }))
                : mention.type === "#"
                ? clients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6)
                    .map((c) => ({ id: c.id, label: c.name, handle: clientHandle(c.name) }))
                : tasks.filter((t) => t.title.toLowerCase().includes(q)).slice(0, 8)
                    .map((t) => ({ id: t.id, label: t.title, handle: t.title, sub: t.status }));
              if (opts.length === 0) return null;
              const pick = (o: Opt) => {
                const before = text.slice(0, mention.start);
                const after = text.slice(mention.start + 1 + mention.query.length);
                if (mention.type === "/") {
                  setAttachTaskId(o.id);
                  setText(before + after);
                } else {
                  const insert = `${mention.type}${o.handle} `;
                  setText(before + insert + after);
                  setTimeout(() => {
                    const pos = (before + insert).length;
                    textareaRef.current?.focus();
                    textareaRef.current?.setSelectionRange(pos, pos);
                  }, 0);
                }
                setMention(null);
                setMentionIdx(0);
              };
              const heading = mention.type === "@" ? "Pessoas" : mention.type === "#" ? "Clientes" : "Tarefas";
              const color = mention.type === "@" ? "text-primary" : mention.type === "#" ? "text-blue-600" : "text-amber-600";
              return (
                <div className="absolute bottom-full left-0 mb-1 w-72 rounded-md border bg-popover shadow-lg z-50 overflow-hidden">
                  <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                    {heading}
                  </div>
                  {opts.map((o, i) => (
                    <button
                      key={o.id}
                      onMouseDown={(e) => { e.preventDefault(); pick(o); }}
                      onMouseEnter={() => setMentionIdx(i)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left",
                        i === mentionIdx ? "bg-accent" : "hover:bg-accent/60"
                      )}
                    >
                      {mention.type === "/" ? <Briefcase className={cn("h-3 w-3 shrink-0", color)} /> : <span className={color}>{mention.type}</span>}
                      <span className="truncate flex-1">{o.label}</span>
                      {o.sub && <Badge variant="secondary" className="text-[10px]">{o.sub}</Badge>}
                    </button>
                  ))}
                </div>
              );
            })()}
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => {
                const v = e.target.value;
                setText(v);
                const pos = e.target.selectionStart ?? v.length;
                const upto = v.slice(0, pos);
                const m = upto.match(/(?:^|\s)([@#/])([\w-]*)$/);
                if (m) {
                  setMention({ type: m[1] as "@" | "#" | "/", query: m[2], start: pos - m[2].length - 1 });
                  setMentionIdx(0);
                } else {
                  setMention(null);
                }
              }}
              onKeyDown={(e) => {
                if (mention) {
                  const q = mention.query.toLowerCase();
                  const opts: { id?: string; handle: string }[] = mention.type === "@"
                    ? profiles.filter((p) => (p.full_name || p.email).toLowerCase().includes(q)).slice(0, 6)
                        .map((p) => ({ handle: handleFromName(p.full_name || p.email) }))
                    : mention.type === "#"
                    ? clients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6)
                        .map((c) => ({ handle: clientHandle(c.name) }))
                    : tasks.filter((t) => t.title.toLowerCase().includes(q)).slice(0, 8)
                        .map((t) => ({ id: t.id, handle: t.title }));
                  if (opts.length) {
                    if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx((i) => (i + 1) % opts.length); return; }
                    if (e.key === "ArrowUp")   { e.preventDefault(); setMentionIdx((i) => (i - 1 + opts.length) % opts.length); return; }
                    if (e.key === "Escape")    { e.preventDefault(); setMention(null); return; }
                    if (e.key === "Enter" || e.key === "Tab") {
                      e.preventDefault();
                      const o = opts[mentionIdx];
                      const before = text.slice(0, mention.start);
                      const after = text.slice(mention.start + 1 + mention.query.length);
                      if (mention.type === "/") {
                        if (o.id) setAttachTaskId(o.id);
                        setText(before + after);
                      } else {
                        const insert = `${mention.type}${o.handle} `;
                        setText(before + insert + after);
                        setTimeout(() => {
                          const pos = (before + insert).length;
                          textareaRef.current?.setSelectionRange(pos, pos);
                        }, 0);
                      }
                      setMention(null);
                      setMentionIdx(0);
                      return;
                    }
                  }
                }
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder={recording ? "Gravando áudio…" : `Mensagem em #${channel.name} — @ pessoas, # clientes, / tarefas`}
              className="min-h-9 max-h-32 resize-none text-sm py-1.5 px-2.5"
              rows={1}
              disabled={recording}
            />
          </div>
          <Button size="icon" className="h-8 w-8 shrink-0" onClick={send} disabled={(!text.trim() && !pendingFile) || uploading || recording}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <MembersDialog
        open={showMembers} onOpenChange={setShowMembers}
        channel={channel} members={members} profiles={profiles}
        canManage={meIsAdmin} onChanged={loadMembers}
      />

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent
          className="max-w-[100vw] w-screen h-screen sm:rounded-none p-0 bg-black/95 border-0 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{lightbox?.name || "Imagem"}</DialogTitle>
          </DialogHeader>
          {lightbox && (
            <img
              src={lightbox.url}
              alt={lightbox.name}
              className="max-w-[95vw] max-h-[95vh] object-contain select-none"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function MembersDialog({
  open, onOpenChange, channel, members, profiles, canManage, onChanged,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  channel: Channel; members: Member[]; profiles: Profile[];
  canManage: boolean; onChanged: () => void;
}) {
  const [toAdd, setToAdd] = useState<string>("");
  const memberIds = new Set(members.map((m) => m.user_id));
  const candidates = profiles.filter((p) => !memberIds.has(p.id));

  async function add() {
    if (!toAdd) return;
    const { error } = await supabase.from("channel_members")
      .insert({ channel_id: channel.id, user_id: toAdd, role: "member" });
    if (error) { toast.error(error.message); return; }
    toast.success("Adicionado"); setToAdd(""); onChanged();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("channel_members").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    onChanged();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Membros — #{channel.name}</DialogTitle></DialogHeader>
        {canManage && channel.type !== "dm" && (
          <div className="flex gap-2">
            <Select value={toAdd} onValueChange={setToAdd}>
              <SelectTrigger><SelectValue placeholder="Adicionar pessoa…" /></SelectTrigger>
              <SelectContent>
                {candidates.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={add} disabled={!toAdd}><UserPlus className="h-4 w-4" /></Button>
          </div>
        )}
        <div className="max-h-80 overflow-y-auto divide-y">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-2">
              <div className="h-7 w-7 rounded-md bg-primary/20 text-primary text-xs font-semibold flex items-center justify-center overflow-hidden">
                {m.profile?.avatar_url ? (
                  <img src={m.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials(m.profile?.full_name || m.profile?.email)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{m.profile?.full_name || m.profile?.email || m.user_id}</div>
                <div className="text-xs text-muted-foreground">{m.role}</div>
              </div>
              {canManage && channel.type !== "dm" && (
                <Button variant="ghost" size="icon" onClick={() => remove(m.id)}>
                  <UserMinus className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const barsRef = useRef<number[]>(
    Array.from({ length: 32 }, () => 0.35 + Math.random() * 0.65)
  );

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.pause();
    else a.play();
  }
  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = pct * duration;
  }
  const progress = duration ? current / duration : 0;

  return (
    <div className="mt-1 inline-flex items-center gap-2 rounded-full border bg-muted/40 pl-1 pr-3 py-1 max-w-xs">
      <button
        type="button"
        onClick={toggle}
        className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 hover:opacity-90"
        aria-label={playing ? "Pausar" : "Reproduzir"}
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
      </button>
      <div
        className="flex items-center gap-[2px] h-6 flex-1 min-w-[120px] cursor-pointer"
        onClick={seek}
      >
        {barsRef.current.map((h, i) => {
          const active = i / barsRef.current.length <= progress;
          return (
            <span
              key={i}
              className={cn("w-[2px] rounded-full transition-colors", active ? "bg-primary" : "bg-muted-foreground/40")}
              style={{ height: `${Math.round(h * 100)}%` }}
            />
          );
        })}
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
        {fmtTime(playing || current ? current : duration)}
      </span>
      <audio
        ref={audioRef}
        src={src}
        preload="auto"

        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrent(0); }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          setDuration(isFinite(d) ? d : 0);
        }}
        className="hidden"
      />
    </div>
  );
}
