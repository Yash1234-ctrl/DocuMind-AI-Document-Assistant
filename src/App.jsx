import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
    AlertCircle,
    ArrowUp,
    BookOpen,
    Check,
    CheckCircle2,
    ChevronDown,
    CircleHelp,
    FileText,
    FileUp,
    FolderPlus,
    LoaderCircle,
    LogOut,
    Menu,
    MessageSquare,
    Plus,
    Sparkles,
    Trash2,
    Upload,
    X,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "http://localhost:8000" : "");

async function api(path, options = {}) {
    const { token, ...requestOptions } = options;
    const headers = new Headers(requestOptions.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);

    let body = requestOptions.body;
    if (body && !(body instanceof FormData) && typeof body !== "string") {
        headers.set("Content-Type", "application/json");
        body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${path}`, {
        ...requestOptions,
        headers,
        body,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const error = new Error(payload?.error || `Request failed (${response.status})`);
        error.status = response.status;
        throw error;
    }
    return payload;
}

async function* readSseEvents(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");

        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
            const frame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            let event = "message";
            const data = [];
            for (const line of frame.split("\n")) {
                if (line.startsWith("event:")) event = line.slice(6).trim();
                if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
            }
            if (data.length) yield { event, data: JSON.parse(data.join("\n")) };
            boundary = buffer.indexOf("\n\n");
        }

        if (done) break;
    }
}

function AuthScreen({ onAuthenticated }) {
    const [mode, setMode] = useState("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
            const result = await api(`/api/auth/${mode}`, {
                method: "POST",
                body: { email: email.trim(), password },
            });
            onAuthenticated(result);
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="auth-layout">
            <div className="auth-glow" />
            <section className="auth-card">
                <div className="brand-lockup auth-brand">
                    <span className="brand-mark"><Sparkles size={19} /></span>
                    <span>DocuMind — AI Document Assistant</span>
                </div>
                <div className="auth-heading">
                    <span className="eyebrow">PRIVATE KNOWLEDGE WORKSPACE</span>
                    <h1>{mode === "login" ? "Welcome back" : "Create your workspace"}</h1>
                    <p>{mode === "login" ? "Sign in to continue your research." : "Start asking better questions of your documents."}</p>
                </div>
                <div className="auth-tabs" role="tablist" aria-label="Authentication">
                    <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }} type="button">Sign in</button>
                    <button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }} type="button">Create account</button>
                </div>
                <form className="auth-form" onSubmit={submit}>
                    <label htmlFor="email">Email</label>
                    <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" />
                    <label htmlFor="password">Password</label>
                    <input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 8 : undefined} maxLength={72} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "register" ? "At least 8 characters" : "Your password"} />
                    {error && <p className="form-error"><AlertCircle size={15} />{error}</p>}
                    <button className="primary-button auth-submit" type="submit" disabled={busy}>
                        {busy ? <LoaderCircle className="spin" size={17} /> : null}
                        {mode === "login" ? "Sign in" : "Create account"}
                        {!busy && <ArrowUp size={16} />}
                    </button>
                </form>
                <p className="auth-footnote"><BookOpen size={14} /> Your documents stay organized by workspace.</p>
            </section>
        </main>
    );
}

function App() {
    const [token, setToken] = useState(() => localStorage.getItem("rag_token") || "");
    const [userEmail, setUserEmail] = useState(() => localStorage.getItem("rag_email") || "");
    const [workspaces, setWorkspaces] = useState([]);
    const [workspaceId, setWorkspaceId] = useState("");
    const [documents, setDocuments] = useState([]);
    const [conversations, setConversations] = useState([]);
    const [conversationId, setConversationId] = useState("");
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [loadingWorkspace, setLoadingWorkspace] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [authError, setAuthError] = useState("");
    const [notice, setNotice] = useState("");
    const [workspaceModal, setWorkspaceModal] = useState(false);
    const [workspaceName, setWorkspaceName] = useState("");
    const [sourcePreview, setSourcePreview] = useState(null);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [apiOnline, setApiOnline] = useState(false);
    const uploadInput = useRef(null);
    const messageEnd = useRef(null);

    const currentWorkspace = workspaces.find((workspace) => workspace._id === workspaceId);
    const hasProcessing = documents.some((document) => document.status === "processing");

    useEffect(() => {
        let active = true;
        const checkHealth = async () => {
            try {
                await api("/health");
                if (active) setApiOnline(true);
            } catch {
                if (active) setApiOnline(false);
            }
        };
        checkHealth();
        const interval = window.setInterval(checkHealth, 20000);
        return () => {
            active = false;
            window.clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        if (!token) return undefined;
        let active = true;
        api("/api/workspaces", { token })
            .then((items) => {
                if (!active) return;
                setWorkspaces(items);
                setWorkspaceId((selected) => items.some((item) => item._id === selected) ? selected : (items[0]?._id || ""));
            })
            .catch((error) => {
                if (!active) return;
                if (error.status === 401) logout();
                else setAuthError(error.message);
            });
        return () => { active = false; };
    }, [token]);

    useEffect(() => {
        if (!token || !workspaceId) {
            setDocuments([]);
            setConversations([]);
            setLoadingWorkspace(false);
            return undefined;
        }
        let active = true;
        setLoadingWorkspace(true);
        setDocuments([]);
        setConversations([]);
        setConversationId("");
        setMessages([]);
        Promise.all([
            api(`/api/workspaces/${workspaceId}/documents`, { token }),
            api(`/api/workspaces/${workspaceId}/chat/conversations`, { token }),
        ])
            .then(([docs, chats]) => {
                if (!active) return;
                setDocuments(docs);
                setConversations(chats);
            })
            .catch((error) => { if (active) setNotice(error.message); })
            .finally(() => { if (active) setLoadingWorkspace(false); });
        return () => { active = false; };
    }, [token, workspaceId]);

    useEffect(() => {
        if (!token || !workspaceId || !hasProcessing) return undefined;
        const interval = window.setInterval(async () => {
            try {
                const docs = await api(`/api/workspaces/${workspaceId}/documents`, { token });
                setDocuments(docs);
            } catch (error) {
                setNotice(error.message);
            }
        }, 2500);
        return () => window.clearInterval(interval);
    }, [token, workspaceId, hasProcessing]);

    useEffect(() => {
        messageEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages, sending]);

    useEffect(() => {
        if (!notice) return undefined;
        const timeout = window.setTimeout(() => setNotice(""), 4200);
        return () => window.clearTimeout(timeout);
    }, [notice]);

    function acceptAuth(result) {
        localStorage.setItem("rag_token", result.token);
        localStorage.setItem("rag_email", result.user.email);
        setUserEmail(result.user.email);
        setToken(result.token);
        setAuthError("");
    }

    function logout() {
        localStorage.removeItem("rag_token");
        localStorage.removeItem("rag_email");
        setToken("");
        setUserEmail("");
        setWorkspaces([]);
        setWorkspaceId("");
        setDocuments([]);
        setConversations([]);
        setMessages([]);
        setConversationId("");
    }

    async function refreshWorkspaceData() {
        if (!workspaceId || !token) return;
        const [docs, chats] = await Promise.all([
            api(`/api/workspaces/${workspaceId}/documents`, { token }),
            api(`/api/workspaces/${workspaceId}/chat/conversations`, { token }),
        ]);
        setDocuments(docs);
        setConversations(chats);
    }

    async function createWorkspace(event) {
        event.preventDefault();
        const name = workspaceName.trim();
        if (!name) return;
        try {
            const workspace = await api("/api/workspaces", { method: "POST", token, body: { name } });
            setWorkspaces((items) => [workspace, ...items]);
            setWorkspaceId(workspace._id);
            setWorkspaceName("");
            setWorkspaceModal(false);
            setMobileSidebarOpen(false);
        } catch (error) {
            setNotice(error.message);
        }
    }

    async function uploadFile(file) {
        if (!file || !workspaceId || loadingWorkspace) return;
        if (file.type !== "application/pdf") {
            setNotice("Choose a PDF file to upload.");
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            setNotice("PDFs must be 20 MB or smaller.");
            return;
        }
        const form = new FormData();
        form.append("file", file);
        setUploading(true);
        try {
            const document = await api(`/api/workspaces/${workspaceId}/documents`, { method: "POST", token, body: form });
            setDocuments((items) => [document, ...items]);
            setNotice(`${file.name} is processing.`);
        } catch (error) {
            setNotice(error.message);
        } finally {
            setUploading(false);
        }
    }

    async function removeDocument(document) {
        if (!window.confirm(`Delete ${document.filename} and its indexed chunks?`)) return;
        try {
            await api(`/api/workspaces/${workspaceId}/documents/${document._id}`, { method: "DELETE", token });
            setDocuments((items) => items.filter((item) => item._id !== document._id));
            setNotice("Document deleted.");
        } catch (error) {
            setNotice(error.message);
        }
    }

    async function openConversation(id) {
        setMobileSidebarOpen(false);
        try {
            const conversation = await api(`/api/workspaces/${workspaceId}/chat/conversations/${id}`, { token });
            setConversationId(id);
            setMessages((conversation.messages || []).map((message, index) => ({
                id: message._id || `${id}-${index}`,
                role: message.role,
                content: message.content,
                sources: message.sources || [],
            })));
        } catch (error) {
            setNotice(error.message);
        }
    }

    async function deleteConversation(conversation) {
        if (!window.confirm(`Delete “${conversation.title || "this chat"}” and its message history?`)) return;
        try {
            await api(`/api/workspaces/${workspaceId}/chat/conversations/${conversation._id}`, { method: "DELETE", token });
            setConversations((items) => items.filter((item) => item._id !== conversation._id));
            if (conversationId === conversation._id) startNewChat();
            setNotice("Chat deleted.");
        } catch (error) {
            setNotice(error.message);
        }
    }

    async function sendMessage(event) {
        event?.preventDefault();
        const question = input.trim();
        if (!question || sending || loadingWorkspace || !workspaceId) return;
        setInput("");

        const generateId = () =>
            crypto.randomUUID
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const assistantId = generateId();

        setMessages((items) => [
            ...items,
            { id: generateId(), role: "user", content: question },
            { id: assistantId, role: "assistant", content: "", sources: [] },
        ]);

        setSending(true);
        let answer = "";
        try {
            const response = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/chat/stream`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ question, ...(conversationId ? { conversationId } : {}) }),
            });
            if (!response.ok) {
                const payload = await response.json().catch(() => null);
                throw new Error(payload?.error || `Request failed (${response.status})`);
            }
            if (!response.body) throw new Error("Streaming is unavailable in this browser.");

            for await (const event of readSseEvents(response.body)) {
                if (event.event === "conversation") {
                    setConversationId(event.data.conversationId);
                } else if (event.event === "delta") {
                    answer += event.data.text || "";
                    setMessages((items) => items.map((message) => message.id === assistantId ? { ...message, content: answer } : message));
                } else if (event.event === "sources") {
                    setMessages((items) => items.map((message) => message.id === assistantId ? { ...message, sources: event.data.sources || [] } : message));
                } else if (event.event === "error") {
                    throw new Error(event.data.error || "The response stream failed.");
                }
            }

            const chats = await api(`/api/workspaces/${workspaceId}/chat/conversations`, { token });
            setConversations(chats);
        } catch (error) {
            setMessages((items) => items.map((message) => message.id === assistantId ? {
                ...message,
                content: answer ? `${answer}\n\nResponse interrupted: ${error.message}` : `I couldn't complete that request. ${error.message}`,
                error: true,
            } : message));
        } finally {
            setSending(false);
        }
    }

    function startNewChat() {
        setConversationId("");
        setMessages([]);
        setInput("");
        setMobileSidebarOpen(false);
    }

    function onComposerKeyDown(event) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    }

    function onDrop(event) {
        event.preventDefault();
        setDragging(false);
        uploadFile(event.dataTransfer.files?.[0]);
    }

    if (!token) return <AuthScreen onAuthenticated={acceptAuth} />;

    return (
        <div className={`app-shell ${mobileSidebarOpen ? "sidebar-open" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }} onDrop={onDrop}>
            {mobileSidebarOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileSidebarOpen(false)} />}
            <aside className="sidebar">
                <div className="sidebar-top">
                    <div className="brand-lockup">
                        <span className="brand-mark"><Sparkles size={18} /></span>
                        <span>DocuMind — AI Document Assistant</span>
                    </div>
                    <button className="icon-button mobile-close" title="Close navigation" aria-label="Close navigation" onClick={() => setMobileSidebarOpen(false)}><X size={17} /></button>
                </div>

                <div className="workspace-picker-wrap">
                    <label className="section-label" htmlFor="workspace-select">WORKSPACE</label>
                    <div className="workspace-picker">
                        <span className="workspace-glyph">{currentWorkspace?.name?.slice(0, 1)?.toUpperCase() || "R"}</span>
                        <select id="workspace-select" value={workspaceId} onChange={(event) => { setWorkspaceId(event.target.value); setMobileSidebarOpen(false); }} aria-label="Select workspace">
                            {workspaces.length === 0 && <option value="">No workspaces</option>}
                            {workspaces.map((workspace) => <option key={workspace._id} value={workspace._id}>{workspace.name}</option>)}
                        </select>
                        <ChevronDown size={15} className="select-chevron" />
                    </div>
                    <button className="sidebar-action" onClick={() => setWorkspaceModal(true)}><FolderPlus size={15} />New workspace</button>
                </div>

                <div className="sidebar-divider" />
                <div className="sidebar-section-heading">
                    <span className="section-label">DOCUMENTS <span className="count-badge">{documents.length}</span></span>
                    <button className="icon-button small" title="Upload PDF" aria-label="Upload PDF" onClick={() => uploadInput.current?.click()} disabled={!workspaceId || uploading || loadingWorkspace}>
                        {uploading ? <LoaderCircle className="spin" size={16} /> : <Plus size={17} />}
                    </button>
                </div>
                <input ref={uploadInput} className="visually-hidden" type="file" accept="application/pdf,.pdf" onChange={(event) => { uploadFile(event.target.files?.[0]); event.target.value = ""; }} />
                <div className="document-list">
                    {documents.length === 0 ? (
                        <div className="sidebar-empty">{loadingWorkspace ? "Loading workspace…" : "Your uploaded PDFs will appear here."}</div>
                    ) : documents.map((document) => (
                        <div className="document-row" key={document._id} title={document.filename}>
                            <span className={`document-icon ${document.status}`}><FileText size={15} /></span>
                            <span className="document-copy">
                                <span className="document-name">{document.filename}</span>
                                <span className={`document-status ${document.status}`}>
                                    {document.status === "processing" ? <><LoaderCircle size={11} className="spin" /> Processing</> : document.status === "ready" ? <><CheckCircle2 size={11} /> {document.pages || 0} pages</> : <><AlertCircle size={11} /> Failed</>}
                                </span>
                            </span>
                            <button className="icon-button document-delete" title={`Delete ${document.filename}`} aria-label={`Delete ${document.filename}`} onClick={() => removeDocument(document)}><Trash2 size={14} /></button>
                        </div>
                    ))}
                    <button className="upload-row" onClick={() => uploadInput.current?.click()} disabled={!workspaceId || uploading || loadingWorkspace}>
                        <Upload size={15} />
                        <span>{uploading ? "Uploading…" : "Upload PDF"}</span>
                        <span className="shortcut">PDF</span>
                    </button>
                </div>

                <div className="sidebar-divider history-divider" />
                <div className="sidebar-section-heading history-heading">
                    <span className="section-label">RECENT CHATS</span>
                    <button className="icon-button small" title="New chat" aria-label="New chat" onClick={startNewChat}><Plus size={17} /></button>
                </div>
                <div className="conversation-list">
                    {conversations.length === 0 ? <div className="sidebar-empty">Your conversations will appear here.</div> : conversations.map((conversation) => (
                        <div className={`conversation-row ${conversation._id === conversationId ? "selected" : ""}`} key={conversation._id}>
                            <button className="conversation-select" onClick={() => openConversation(conversation._id)} title={conversation.title || "New conversation"}>
                                <MessageSquare size={14} />
                                <span>{conversation.title || "New conversation"}</span>
                            </button>
                            <button className="conversation-delete" onClick={() => deleteConversation(conversation)} title={`Delete ${conversation.title || "chat"}`} aria-label={`Delete ${conversation.title || "chat"}`}>
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="sidebar-bottom">
                    <div className="account-avatar">{userEmail.slice(0, 1).toUpperCase() || "U"}</div>
                    <div className="account-copy"><strong>{userEmail || "Account"}</strong><span>Personal workspace</span></div>
                    <button className="icon-button" title="Sign out" aria-label="Sign out" onClick={logout}><LogOut size={16} /></button>
                </div>
            </aside>

            <main className="main-panel">
                <header className="topbar">
                    <div className="topbar-left">
                        <button className="icon-button mobile-menu" title="Open navigation" aria-label="Open navigation" onClick={() => setMobileSidebarOpen(true)}><Menu size={19} /></button>
                        <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-separator">/</span><strong>{currentWorkspace?.name || "Select a workspace"}</strong></div>
                    </div>
                    <div className="topbar-actions">
                        <span className={`api-status ${apiOnline ? "" : "offline"}`}><span className="status-dot" /> {apiOnline ? "API connected" : "API offline"}</span>
                        <button className="new-chat-button" onClick={startNewChat}><Plus size={15} /><span>New chat</span></button>
                    </div>
                </header>

                <div className={`chat-area ${dragging ? "dragging" : ""}`}>
                    <div className="chat-scroll">
                        {messages.length === 0 ? (
                            <div className="welcome-state">
                                <div className="welcome-symbol"><Sparkles size={22} /></div>
                                <span className="eyebrow">DOCUMENT INTELLIGENCE</span>
                                <h1>{loadingWorkspace ? "Loading workspace…" : documents.length ? "Ask your documents." : "Start with a PDF."}</h1>
                                <p>{loadingWorkspace ? "Fetching documents and conversations." : documents.length ? "Get grounded answers with page-level sources." : "Add a document to build a searchable knowledge space."}</p>
                                {loadingWorkspace ? (
                                    <div className="workspace-loading"><LoaderCircle className="spin" size={17} /> Loading</div>
                                ) : documents.length ? (
                                    <div className="suggestion-grid">
                                        {[
                                            "What is this document about?",
                                            "Summarize the key points",
                                            "What should I remember?",
                                        ].map((suggestion) => <button key={suggestion} onClick={() => setInput(suggestion)}><Sparkles size={14} />{suggestion}<ArrowUp size={14} /></button>)}
                                    </div>
                                ) : (
                                    <button className="empty-upload" onClick={() => uploadInput.current?.click()}><FileUp size={18} /><span>Choose a PDF</span><span>Up to 20 MB</span></button>
                                )}
                            </div>
                        ) : (
                            <div className="message-list">
                                {messages.map((message) => (
                                    <article className={`message ${message.role} ${message.error ? "message-error" : ""}`} key={message.id}>
                                        <div className={`message-avatar ${message.role}`}>
                                            {message.role === "assistant" ? message.error ? <AlertCircle size={16} /> : <Sparkles size={16} /> : <span>{userEmail.slice(0, 1).toUpperCase() || "U"}</span>}
                                        </div>
                                        <div className="message-content">
                                            <div className="message-meta"><strong>{message.role === "assistant" ? "Assistant" : "You"}</strong>{message.role === "assistant" && <span>Grounded response</span>}</div>
                                            <div className="message-text"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown></div>
                                            {message.sources?.length > 0 && (
                                                <div className="source-list">
                                                    {message.sources.map((source, index) => (
                                                        <button className="source-chip" key={`${source.index}-${source.filename}-${index}`} onClick={() => setSourcePreview(source)}>
                                                            <FileText size={13} /><span>{source.filename}</span><span className="source-page">p. {source.pageNumber}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </article>
                                ))}
                                {sending && <article className="message assistant typing-message"><div className="message-avatar assistant"><Sparkles size={16} /></div><div className="typing-indicator"><span /><span /><span /></div></article>}
                                <div ref={messageEnd} />
                            </div>
                        )}
                    </div>

                    <div className="composer-wrap">
                        {dragging && <div className="drop-overlay"><Upload size={22} />Drop a PDF to add it to this workspace</div>}
                        <form className="composer" onSubmit={sendMessage}>
                            <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onComposerKeyDown} placeholder={loadingWorkspace ? "Loading workspace…" : documents.length ? "Ask something about your documents…" : "Upload a PDF to start asking questions…"} disabled={!workspaceId || sending || loadingWorkspace} rows={1} aria-label="Ask a question" />
                            <div className="composer-toolbar">
                                <div className="composer-hint"><CircleHelp size={13} /><span>Answers include document sources</span></div>
                                <button className={`send-button ${input.trim() ? "ready" : ""}`} type="submit" disabled={!input.trim() || sending || loadingWorkspace || !workspaceId} title="Send message" aria-label="Send message">
                                    {sending ? <LoaderCircle size={17} className="spin" /> : <ArrowUp size={17} />}
                                </button>
                            </div>
                        </form>
                        <p className="composer-caption">AI can make mistakes. Verify important details in the cited pages.</p>
                    </div>
                </div>
            </main>

            {notice && <div className="toast" role="status"><Check size={15} />{notice}<button aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={14} /></button></div>}
            {authError && <div className="toast error-toast" role="alert"><AlertCircle size={15} />{authError}<button aria-label="Dismiss notification" onClick={() => setAuthError("")}><X size={14} /></button></div>}

            {workspaceModal && (
                <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setWorkspaceModal(false); }}>
                    <form className="modal-card" onSubmit={createWorkspace}>
                        <div className="modal-heading"><div className="modal-icon"><FolderPlus size={18} /></div><button className="icon-button" type="button" aria-label="Close" onClick={() => setWorkspaceModal(false)}><X size={17} /></button></div>
                        <h2>New workspace</h2>
                        <p>Keep documents and conversations together.</p>
                        <label htmlFor="workspace-name">Workspace name</label>
                        <input id="workspace-name" autoFocus maxLength={80} value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="e.g. Product research" />
                        <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setWorkspaceModal(false)}>Cancel</button><button className="primary-button" type="submit" disabled={!workspaceName.trim()}>Create workspace <ArrowUp size={15} /></button></div>
                    </form>
                </div>
            )}

            {sourcePreview && (
                <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSourcePreview(null); }}>
                    <section className="source-modal" role="dialog" aria-modal="true" aria-labelledby="source-title">
                        <div className="source-modal-top"><div className="source-file-icon"><FileText size={17} /></div><button className="icon-button" aria-label="Close source" onClick={() => setSourcePreview(null)}><X size={17} /></button></div>
                        <span className="eyebrow">SOURCE PASSAGE · PAGE {sourcePreview.pageNumber}</span>
                        <h2 id="source-title">{sourcePreview.filename}</h2>
                        <p>{sourcePreview.snippet}</p>
                        <button className="secondary-button source-close" onClick={() => setSourcePreview(null)}>Close</button>
                    </section>
                </div>
            )}
        </div>
    );
}

export default App;
