// api/callback.js
export default async function handler(req, res) {
    const { code } = req.query;
    if (!code) return res.redirect('/discuss.html?error=no_code');

    try {
        // 1. Trade the code for a Token
        const tokenRes = await fetch('https://apis.roblox.com/oauth/v1/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id:4112872619143689543',
                client_secret: 'RBX-CK_UuJG7HEO9ft1WDfNCzZPsjqPdFJYFsA1IvtqgUQ3FkEh8PnzYRkYzWNeyFZ1L', // <--- PASTE SECRET KEY
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: 'https://adiyan-dev-hub.vercel.app/api/callback' // <--- YOUR VERCEL URL
            })
        });

        const tokens = await tokenRes.json();

        // 2. Get the User's Real Name and Photo
        const userRes = await fetch('https://apis.roblox.com/oauth/v1/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` }
        });

        const user = await userRes.json();

        // 3. Send them back to the chat with their data
        res.redirect(`/discuss.html?username=${encodeURIComponent(user.preferred_username)}&avatar=${encodeURIComponent(user.picture)}`);
    } catch (e) {
        res.redirect('/discuss.html?error=auth_failed');
    }
}