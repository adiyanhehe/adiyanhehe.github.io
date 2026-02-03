// api/callback.js
export default async function handler(req, res) {
    const { code } = req.query;
    // ... (rest of the code I gave you)
    
    body: new URLSearchParams({
        client_id: '4112872619143689543',
        client_secret: 'RBX-CK_UuJG7HEO9ft1WDfNCzZPsjqPdFJYFsA1IvtqgUQ3FkEh8PnzYRkYzWNeyFZ1L',
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: 'https://adiyanhehe-github-io.vercel.app/api/callback' // <--- MUST MATCH THIS
    })
    // ...
}
