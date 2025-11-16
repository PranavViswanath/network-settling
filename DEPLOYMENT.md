# Deployment Guide

## Quick Deploy to GitHub Pages

### 1. Initialize Git Repository

```bash
git init
git add .
git commit -m "Initial commit: Network Settling Visualizer"
```

### 2. Create GitHub Repository

1. Go to [GitHub](https://github.com/new)
2. Create a new repository (e.g., `network-settling`)
3. **Do NOT** initialize with README (we already have one)

### 3. Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/network-settling.git
git branch -M main
git push -u origin main
```

### 4. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (top right)
3. Scroll to **Pages** section (left sidebar)
4. Under **Source**:
   - Branch: `main`
   - Folder: `/ (root)`
5. Click **Save**

### 5. Access Your Site

Your site will be available at:
```
https://YOUR_USERNAME.github.io/network-settling/
```

**Note**: First deployment may take 2-3 minutes. Check the Actions tab to see deployment progress.

## Alternative Deployment Options

### Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Follow prompts. Your site will be live instantly!

### Netlify

1. Go to [Netlify](https://app.netlify.com/)
2. Drag and drop your project folder
3. Site is live immediately!

Or use Netlify CLI:
```bash
npm i -g netlify-cli
netlify deploy --prod
```

### Local Testing

Before deploying, test locally:

```bash
# Python
python -m http.server 8000

# Node.js
npx serve

# PHP
php -S localhost:8000
```

Then visit `http://localhost:8000`

## Important Notes

### First Load Performance

- Pyodide downloads ~10MB on first load
- Takes 10-15 seconds to initialize
- Subsequent loads are cached by browser
- Consider adding a loading screen (already included!)

### CORS Requirements

- Must be served via HTTP/HTTPS (not `file://`)
- GitHub Pages handles this automatically
- Local testing requires a web server

### Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome  | ✅ Full |
| Firefox | ✅ Full |
| Safari  | ✅ 14+  |
| Edge    | ✅ Full |
| Mobile  | ✅ Responsive |

### Performance Tips

1. **Use CDN for Pyodide**: Already configured in HTML
2. **Enable Browser Caching**: GitHub Pages does this automatically
3. **Optimize for Mobile**: Already responsive
4. **Service Workers**: Consider adding for offline support

## Troubleshooting

### "Site not found" after deployment

- Wait 2-3 minutes for GitHub Pages to build
- Check Actions tab for build status
- Ensure branch is set to `main` in Pages settings

### Pyodide fails to load

- Check browser console for errors
- Ensure internet connection (Pyodide loads from CDN)
- Try different browser
- Clear cache and reload

### Changes not showing up

```bash
git add .
git commit -m "Update: description of changes"
git push
```

Wait 1-2 minutes for GitHub Pages to rebuild.

## Custom Domain (Optional)

1. Buy a domain (e.g., from Namecheap, Google Domains)
2. In GitHub Pages settings, add custom domain
3. Configure DNS:
   - Add CNAME record pointing to `YOUR_USERNAME.github.io`
   - Or A records to GitHub Pages IPs
4. Enable HTTPS (automatic after DNS propagates)

## Analytics (Optional)

Add Google Analytics to `index.html`:

```html
<head>
    <!-- ... existing head content ... -->
    
    <!-- Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'GA_MEASUREMENT_ID');
    </script>
</head>
```

## Monitoring

Check your site status:
- GitHub Actions: See deployment logs
- GitHub Pages: Settings → Pages shows current status
- Browser DevTools: Check console for errors

## Updates

To update your deployed site:

```bash
# Make changes to files
git add .
git commit -m "Update: your changes"
git push
```

GitHub Pages automatically rebuilds and deploys!

---

**Your site will be live at**: `https://YOUR_USERNAME.github.io/network-settling/`

**Estimated time**: 5 minutes from start to live site! 🚀

