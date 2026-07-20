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
  Hash, Lock, MessageCircle, Plus, Users, UserPlus, UserMinus, Send, Briefcase,
  Paperclip, X, Reply, Mic, Square, Bell, File as FileIcon, Image as ImageIcon,
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
    <div className="flex h-[calc(100vh-3.5rem)] bg-background">
      {/* Channel sidebar */}
      <aside className="w-64 shrink-0 border-r bg-card text-foreground flex flex-col">
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
      <section className="flex-1 min-w-0 flex flex-col">
        {active ? (
          <ChannelView channel={active} profiles={profiles} isAgencyAdmin={hasRole("admin")} />
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
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("channel_members").select("user_id").eq("channel_id", channel.id);
      const other = (data ?? []).find((m) => m.user_id !== meId);
      if (other) {
        const p = profiles.find((x) => x.id === other.user_id);
        if (p) setOtherName(p.full_name || p.email);
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
      <div className="h-5 w-5 rounded-full bg-primary/30 text-[10px] flex items-center justify-center shrink-0">
        {initials(otherName)}
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

function ChannelView({ channel, profiles, isAgencyAdmin }: { channel: Channel; profiles: Profile[]; isAgencyAdmin: boolean }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [text, setText] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [attachTaskId, setAttachTaskId] = useState<string | null>(null);
  const [mention, setMention] = useState<{ type: "@" | "#"; query: string; start: number } | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
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
    const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
    const path = `${user.id}/${channel.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("chat-attachments").upload(path, blob, {
      contentType: blob.type || "application/octet-stream", upsert: false,
    });
    if (error) { toast.error(error.message); return null; }
    const { data: signed } = await supabase.storage.from("chat-attachments").createSignedUrl(path, 60 * 60 * 24 * 365);
    return { url: signed?.signedUrl || "", type: blob.type, name: filename, size: blob.size, kind };
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

  const Icon = channel.type === "client" ? Briefcase : channel.type === "dm" ? MessageCircle
    : channel.type === "private" ? Lock : Hash;

  return (
    <>
      <header className="h-14 border-b flex items-center gap-3 px-4 shrink-0">
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
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-16">Sem mensagens. Diga oi 👋</div>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const grouped = prev && prev.author_id === m.author_id && !m.parent_id
              && (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000);
            return (
              <div key={m.id} className={cn("group flex gap-3", grouped && "pl-11")}>
                {!grouped && (
                  <div className="h-8 w-8 rounded-md bg-primary/20 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                    {initials(m.author?.full_name || m.author?.email)}
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
                  <div id={`msg-${m.id}`} className="text-sm whitespace-pre-wrap break-words">{m.body}</div>
                  {m.attachment_url && m.attachment_kind === "image" && (
                    <a href={m.attachment_url} target="_blank" rel="noreferrer">
                      <img src={m.attachment_url} alt={m.attachment_name || "imagem"} className="mt-1 max-h-64 rounded-md border" />
                    </a>
                  )}
                  {m.attachment_url && m.attachment_kind === "audio" && (
                    <audio controls src={m.attachment_url} className="mt-1 h-8" />
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

      <div className="border-t p-3 shrink-0 space-y-2">
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
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef} type="file" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setPendingFile(f); e.currentTarget.value = ""; }}
          />
          <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} title="Anexar arquivo" disabled={recording}>
            <Paperclip className="h-4 w-4" />
          </Button>
          {!recording ? (
            <Button variant="outline" size="icon" onClick={startRecording} title="Gravar áudio">
              <Mic className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="destructive" size="icon" onClick={stopRecording} title="Parar gravação">
              <Square className="h-4 w-4" />
            </Button>
          )}
          {tasks.length > 0 && (
            <Select value={attachTaskId ?? ""} onValueChange={(v) => setAttachTaskId(v || null)}>
              <SelectTrigger className="w-10 h-10 p-0 justify-center" aria-label="Anexar tarefa">
                <Briefcase className="h-4 w-4" />
              </SelectTrigger>
              <SelectContent>
                {tasks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Textarea
            value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={recording ? "Gravando áudio…" : `Mensagem em #${channel.name}`}
            className="min-h-10 max-h-40 resize-none"
            disabled={recording}
          />
          <Button onClick={send} disabled={(!text.trim() && !pendingFile) || uploading || recording}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <MembersDialog
        open={showMembers} onOpenChange={setShowMembers}
        channel={channel} members={members} profiles={profiles}
        canManage={meIsAdmin} onChanged={loadMembers}
      />
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
              <div className="h-7 w-7 rounded-md bg-primary/20 text-primary text-xs font-semibold flex items-center justify-center">
                {initials(m.profile?.full_name || m.profile?.email)}
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
