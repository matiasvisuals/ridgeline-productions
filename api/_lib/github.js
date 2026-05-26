// Minimal GitHub Contents API client — commits a single file via PUT.
const API = 'https://api.github.com';

function repoEnv() {
    const repo = process.env.GITHUB_REPO; // owner/repo
    const token = process.env.GITHUB_TOKEN;
    const branch = process.env.GITHUB_BRANCH || 'main';
    if (!repo || !token) throw new Error('github_not_configured');
    return { repo, token, branch };
}

async function ghRequest(path, init = {}) {
    const { token } = repoEnv();
    const res = await fetch(`${API}${path}`, {
        ...init,
        headers: {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            Authorization: `Bearer ${token}`,
            'User-Agent': 'ridgeline-admin',
            ...(init.headers || {}),
        },
    });
    if (res.status === 404) return { status: 404, data: null };
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const msg = (data && (data.message || JSON.stringify(data))) || res.statusText;
        const err = new Error(`github_${res.status}: ${msg}`);
        err.status = res.status;
        throw err;
    }
    return { status: res.status, data };
}

export async function getFileSha(filePath) {
    const { repo, branch } = repoEnv();
    const { status, data } = await ghRequest(
        `/repos/${repo}/contents/${encodeURI(filePath)}?ref=${encodeURIComponent(branch)}`
    );
    if (status === 404 || !data) return null;
    return data.sha || null;
}

export async function putFile(filePath, contentString, message) {
    const { repo, branch } = repoEnv();
    const sha = await getFileSha(filePath);
    const body = {
        message: message || `chore(content): update ${filePath}`,
        content: Buffer.from(contentString, 'utf8').toString('base64'),
        branch,
        ...(sha ? { sha } : {}),
    };
    const { data } = await ghRequest(
        `/repos/${repo}/contents/${encodeURI(filePath)}`,
        { method: 'PUT', body: JSON.stringify(body) }
    );
    return data;
}
