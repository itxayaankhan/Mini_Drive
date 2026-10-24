import { useEffect, useRef, useState } from "react";
import { createSHA256 } from "hash-wasm";
import {
  Cloud,
  UploadCloud,
  FileText,
  FileVideo,
  FileImage,
  File as FileIcon,
  Download,
  LogOut,
  Search,
  ShieldCheck,
  RefreshCw,
  HardDrive,
  LockKeyhole,
  UserRound,
  CheckCircle2,
  Trash2,
} from "lucide-react";

const CHUNK_SIZE = 5 * 1024 * 1024;
const MAX_SIZE = 2 * 1024 * 1024 * 1024;
const tokenKey = "minidrive_token";
const userKey = "minidrive_user";

async function api(url, options = {}) {
  const token = localStorage.getItem(tokenKey);
  const headers = { ...(options.headers || {}) };

  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem(tokenKey);
      localStorage.removeItem(userKey);
      window.dispatchEvent(new Event("minidrive-logout"));
    }

    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

async function hashFile(file, onProgress) {
  const hash = await createSHA256();
  const count = Math.ceil(file.size / CHUNK_SIZE);

  for (let i = 0; i < count; i++) {
    const buffer = await file
      .slice(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, file.size))
      .arrayBuffer();

    hash.update(new Uint8Array(buffer));
    onProgress(i + 1, count);
  }

  return hash.digest("hex");
}

function formatSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function Glyph({ name }) {
  const ext = name.split(".").pop()?.toLowerCase();

  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
    return (
      <span className="glyph image">
        <FileImage size={19} />
      </span>
    );
  }

  if (["mp4", "mov", "mkv", "webm"].includes(ext)) {
    return (
      <span className="glyph video">
        <FileVideo size={19} />
      </span>
    );
  }

  if (["pdf", "doc", "docx", "txt", "xlsx", "pptx"].includes(ext)) {
    return (
      <span className="glyph doc">
        <FileText size={19} />
      </span>
    );
  }

  return (
    <span className="glyph other">
      <FileIcon size={19} />
    </span>
  );
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      const result = await api(
        `/api/auth/${mode === "login" ? "login" : "register"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        }
      );

      localStorage.setItem(tokenKey, result.token);
      localStorage.setItem(userKey, JSON.stringify(result.user));
      onAuth(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-visual">
        <div className="auth-brand">
          <span className="brand-icon"><Cloud size={22} /></span>
          mini<span>drive</span>
        </div>

        <div className="visual-copy">
          <span className="kicker">YOUR PERSONAL CLOUD</span>
          <h1>All your files.<br /><em>One safe place.</em></h1>
          <p>
            A calmer way to store, find, and manage the documents that matter to you.
          </p>

          <div className="visual-points">
            <span><ShieldCheck size={17} /> Private by account</span>
            <span><RefreshCw size={17} /> Resumable uploads</span>
            <span><HardDrive size={17} /> Your own drive</span>
          </div>
        </div>

        <div className="visual-orb orb-one" />
        <div className="visual-orb orb-two" />

        <div className="visual-note">
          <div className="note-icon"><FileText size={18} /></div>
          <div>
            <strong>Documents, organized</strong>
            <span>Only visible in your account</span>
          </div>
          <CheckCircle2 size={19} className="note-check" />
        </div>
      </div>

      <div className="auth-side">
        <div className="auth-form-wrap">
          <div className="mobile-brand">
            <span className="brand-icon"><Cloud size={21} /></span>
            minidrive
          </div>

          <span className="kicker">
            {mode === "login" ? "WELCOME BACK" : "GET STARTED"}
          </span>

          <h2>{mode === "login" ? "Sign in to your drive" : "Create your account"}</h2>

          <p className="form-sub">
            {mode === "login"
              ? "Your files are waiting right where you left them."
              : "Create a private drive for your documents."}
          </p>

          <form onSubmit={submit} className="auth-form">
            {mode === "register" && (
              <label>
                Full name
                <div className="input-wrap">
                  <UserRound size={17} />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    required
                    minLength={2}
                  />
                </div>
              </label>
            )}

            <label>
              Email address
              <div className="input-wrap">
                <span className="at-symbol">@</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            </label>

            <label>
              Password
              <div className="input-wrap">
                <LockKeyhole size={17} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "At least 8 characters" : "Enter your password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={mode === "register" ? 8 : 1}
                  required
                />
              </div>
            </label>

            {error && <div className="auth-error">{error}</div>}

            <button className="auth-submit" disabled={busy}>
              {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
              <span>→</span>
            </button>
          </form>

          <p className="auth-switch">
            {mode === "login" ? "New to Mini Drive?" : "Already have an account?"}
            {" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
              }}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>

          <div className="auth-security">
            <ShieldCheck size={15} />
            Passwords are securely hashed. Each account has a separate drive.
          </div>
        </div>

        <footer className="auth-footer">
          MINI DRIVE <span>·</span> PRIVATE FILE STORAGE
        </footer>
      </div>
    </div>
  );
}

export default function MiniDrive() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(userKey) || "null");
    } catch {
      return null;
    }
  });

  const [file, setFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState("idle");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [chunkProgress, setChunkProgress] = useState({ done: 0, total: 0 });
  const [health, setHealth] = useState("checking");
  const [deletingId, setDeletingId] = useState(null);

  const inputRef = useRef(null);
  const busy = ["hashing", "initializing", "uploading"].includes(phase);

  useEffect(() => {
    const logout = () => setUser(null);
    window.addEventListener("minidrive-logout", logout);
    return () => window.removeEventListener("minidrive-logout", logout);
  }, []);

  async function loadFiles() {
    try {
      const result = await api("/api/files");
      setFiles(result.files || []);
      setHealth("connected");
    } catch (err) {
      setHealth("offline");
      setError(err.message);
    }
  }

  useEffect(() => {
    if (!user) return;

    api("/api/auth/me")
      .then((result) => setUser(result.user))
      .catch(() => {});

    api("/api/health")
      .then((data) => setHealth(data.database === "connected" ? "connected" : "offline"))
      .catch(() => setHealth("offline"));

    loadFiles();
  }, [user?.id]);

  function logout() {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    setUser(null);
    setFiles([]);
    setFile(null);
    setError("");
    setStatus("");
  }

  function chooseFile(e) {
    const chosen = e.target.files?.[0] || null;
    setFile(chosen);
    setError("");
    setStatus(chosen ? "Ready to upload." : "");
    setPhase("idle");
    setProgress(0);
    setChunkProgress({ done: 0, total: 0 });

    // Allow selecting the same file again after an upload.
    e.target.value = "";
  }

  async function startUpload() {
    if (!file || busy) return;

    setError("");
    setStatus("");
    setProgress(0);

    if (!file.size || file.size > MAX_SIZE) {
      setError(file.size ? "Maximum file size is 2 GB." : "Empty files are not supported.");
      setPhase("error");
      return;
    }

    const total = Math.ceil(file.size / CHUNK_SIZE);
    setChunkProgress({ done: 0, total });

    try {
      setPhase("hashing");
      setStatus("Calculating file fingerprint...");

      const fileHash = await hashFile(file, (done, count) => {
        setProgress(Math.round((done / count) * 100));
        setStatus(`Checking file integrity · ${done}/${count} blocks`);
      });

      setPhase("initializing");
      setStatus("Preparing your private drive...");

      const init = await api("/api/upload/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          totalSize: file.size,
          totalChunks: total,
          fileHash,
        }),
      });

      if (init.instant) {
        setPhase("done");
        setStatus("This file is already in your drive. No upload needed.");
        await loadFiles();
        return;
      }

      const uploaded = new Set(init.uploadedChunks || []);
      setChunkProgress({ done: uploaded.size, total });

      for (let index = 1; index <= total; index++) {
        if (uploaded.has(index)) continue;

        setPhase("uploading");
        setStatus(`Uploading ${uploaded.size} of ${total} chunks...`);

        const form = new FormData();
        form.append("uploadId", init.uploadId);
        form.append("chunkIndex", String(index));
        form.append(
          "chunk",
          file.slice((index - 1) * CHUNK_SIZE, Math.min(index * CHUNK_SIZE, file.size)),
          `chunk-${index}.part`
        );

        const result = await api("/api/upload/chunk", {
          method: "POST",
          body: form,
        });

        uploaded.add(index);
        setChunkProgress({ done: uploaded.size, total });
        setProgress(Math.round((uploaded.size / total) * 100));

        if (result.completed) {
          setStatus("Saving your file...");
        }
      }

      setPhase("done");
      setStatus("Upload complete. Your file is now in your drive.");
      setFile(null);
      await loadFiles();
    } catch (err) {
      setError(err.message || "Upload failed.");
      setPhase("error");
      setStatus("You can retry with the same file to resume the upload.");
    }
  }

  async function deleteFile(item) {
    const confirmed = window.confirm(
      `Permanently delete "${item.originalName}"? This cannot be undone.`
    );

    if (!confirmed || deletingId) return;

    setDeletingId(item._id);
    setError("");
    setStatus("");

    try {
      await api(`/api/files/${item._id}`, {
        method: "DELETE",
      });

      setFiles((current) => current.filter((entry) => entry._id !== item._id));
      setStatus(`"${item.originalName}" was deleted successfully.`);
    } catch (err) {
      setError(err.message || "Could not delete the file.");
    } finally {
      setDeletingId(null);
    }
  }

  function downloadFile(item) {
    const token = localStorage.getItem(tokenKey);
    const anchor = document.createElement("a");

    anchor.href = `/api/files/${item._id}/download?token=${encodeURIComponent(token || "")}`;
    anchor.download = item.originalName;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  if (!user) return <AuthScreen onAuth={setUser} />;

  const visibleFiles = files.filter((entry) =>
    entry.originalName.toLowerCase().includes(query.toLowerCase())
  );

  const totalBytes = files.reduce((sum, item) => sum + item.size, 0);

  return (
    <div className="drive-app">
      <aside className="drive-sidebar">
        <div className="drive-brand">
          <span className="brand-icon"><Cloud size={21} /></span>
          mini<span>drive</span>
        </div>

        <button className="new-upload" onClick={() => inputRef.current?.click()}>
          <UploadCloud size={17} /> New upload
        </button>

        <div className="sidebar-label">YOUR WORKSPACE</div>

        <div className="sidebar-active">
          <HardDrive size={18} /> My Drive <span>{files.length}</span>
        </div>

        <div className="sidebar-storage">
          <div className="storage-heading">
            Storage overview <HardDrive size={15} />
          </div>
          <strong>{formatSize(totalBytes)}</strong>
          <span>used by your files</span>
          <div className="storage-track">
            <i style={{ width: `${Math.min(100, (totalBytes / (5 * 1024 ** 3)) * 100)}%` }} />
          </div>
          <small>File bytes stored on server · metadata in Atlas</small>
        </div>

        <div className="sidebar-user">
          <div className="user-avatar">{(user.name || "U").slice(0, 1).toUpperCase()}</div>
          <div className="user-label">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <button title="Sign out" onClick={logout}>
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      <main className="drive-main">
        <header className="drive-topbar">
          <div>
            <span>Workspace</span><b>/</b><strong>My Drive</strong>
          </div>

          <div className="topbar-right">
            <label className="drive-search">
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your files..."
              />
            </label>

            <span className={`db-status ${health}`}>
              <i />
              {health === "connected"
                ? "Atlas connected"
                : health === "checking"
                  ? "Connecting"
                  : "API offline"}
            </span>
          </div>
        </header>

        <section className="drive-content">
          <div className="drive-welcome">
            <div>
              <span className="kicker">YOUR SPACE, ORGANIZED</span>
              <h1>My Drive</h1>
              <p>Welcome back, {(user.name || "there").split(" ")[0]}. Your files are private to your account.</p>
            </div>

            <button className="primary-btn" onClick={() => inputRef.current?.click()}>
              <UploadCloud size={18} /> Upload files
            </button>
          </div>

          <section className="upload-card">
            <div className="upload-card-title">
              <span className="upload-icon"><UploadCloud size={22} /></span>
              <div>
                <h2>Upload to your drive</h2>
                <p>Secure, resumable uploads in 5 MB chunks.</p>
              </div>
            </div>

            <div
              className="drop-zone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();

                if (!busy && e.dataTransfer.files?.[0]) {
                  setFile(e.dataTransfer.files[0]);
                  setPhase("idle");
                  setError("");
                  setStatus("File ready to upload.");
                }
              }}
            >
              <input ref={inputRef} type="file" onChange={chooseFile} disabled={busy} />
              <div className="drop-symbol"><UploadCloud size={24} /></div>
              <p>
                <button type="button" onClick={() => inputRef.current?.click()}>
                  Choose a file
                </button>
                {" "}or drag it here
              </p>
              <small>Any file type · Maximum 2 GB · 5 MB chunks</small>

              {file && (
                <div className="selected-file">
                  <Glyph name={file.name} />
                  <div>
                    <strong>{file.name}</strong>
                    <span>{formatSize(file.size)}</span>
                  </div>
                  <button type="button" onClick={() => setFile(null)} disabled={busy}>×</button>
                </div>
              )}
            </div>

            {(busy || status || error) && (
              <div className="upload-feedback">
                <div>
                  <span className={error ? "error-text" : ""}>{error || status}</span>
                  {busy && (
                    <b>
                      {phase === "hashing"
                        ? progress
                        : Math.round((chunkProgress.done / Math.max(1, chunkProgress.total)) * 100)}
                      %
                    </b>
                  )}
                </div>

                {busy && (
                  <div className="progress-track">
                    <i
                      style={{
                        width: `${
                          phase === "hashing"
                            ? progress
                            : Math.round((chunkProgress.done / Math.max(1, chunkProgress.total)) * 100)
                        }%`,
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="upload-card-footer">
              <span><ShieldCheck size={15} /> SHA-256 check</span>
              <span><RefreshCw size={15} /> Resume support</span>
              <span><CheckCircle2 size={15} /> Duplicate detection</span>
              <button className="primary-btn small" disabled={!file || busy} onClick={startUpload}>
                {busy ? "Uploading..." : "Start upload"}
              </button>
            </div>
          </section>

          <div className="files-title">
            <div>
              <h2>All your documents</h2>
              <p>{visibleFiles.length} files · {formatSize(totalBytes)} total</p>
            </div>

            <button className="refresh-btn" onClick={loadFiles}>
              <RefreshCw size={15} /> Refresh
            </button>
          </div>

          {visibleFiles.length ? (
            <div className="documents-grid">
              {visibleFiles.map((item) => (
                <article className="document-card" key={item._id}>
                  <div className="document-top">
                    <Glyph name={item.originalName} />
                    <button onClick={() => downloadFile(item)} title="Download">
                      <Download size={17} />
                    </button>
                  </div>

                  <strong title={item.originalName}>{item.originalName}</strong>
                  <span>
                    {formatSize(item.size)} · {new Date(item.createdAt).toLocaleDateString()}
                  </span>

                  <div className="document-actions">
                    <button className="document-download" onClick={() => downloadFile(item)}>
                      <Download size={15} /> Download
                    </button>

                    <button
                      className="document-delete"
                      onClick={() => deleteFile(item)}
                      disabled={deletingId === item._id}
                      title={`Delete ${item.originalName}`}
                    >
                      <Trash2 size={15} />
                      {deletingId === item._id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-documents">
              <div><HardDrive size={29} /></div>
              <h3>{query ? "No files match your search" : "Your drive is empty"}</h3>
              <p>
                {query
                  ? "Try a different filename."
                  : "Upload a document and it will appear here. Only you can see files in this drive."}
              </p>
              <button className="secondary-btn" onClick={() => inputRef.current?.click()}>
                ＋ Upload your first file
              </button>
            </div>
          )}

          {(error || status) && !busy && (
            <div className={`upload-feedback ${error ? "error-text" : ""}`}>
              {error || status}
            </div>
          )}

          <div className="privacy-note">
            <ShieldCheck size={17} />
            <span>
              <strong>Your drive is private</strong>
              <small>Each account can only list, upload, and download its own documents.</small>
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}
