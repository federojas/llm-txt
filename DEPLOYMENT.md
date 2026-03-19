# Deployment Guide

This guide covers deploying the llms.txt Generator to various platforms.

## Vercel (Recommended)

Vercel is the easiest and fastest way to deploy this Next.js application.

### Prerequisites

- GitHub account
- Vercel account (free tier available)

### Steps

1. **Push to GitHub**

   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Configure project:
     - Framework Preset: Next.js (auto-detected)
     - Root Directory: ./
     - Build Command: `npm run build` (default)
     - Output Directory: `.next` (default)
   - Click "Deploy"

3. **Deployment Complete**
   - Vercel will automatically build and deploy
   - You'll get a production URL: `https://your-project.vercel.app`
   - Future git pushes will automatically deploy

### Environment Variables

No environment variables are required for basic functionality.

### Custom Domain (Optional)

1. Go to Project Settings > Domains
2. Add your custom domain
3. Configure DNS records as instructed by Vercel

---

## Netlify

### Steps

1. **Build Settings**
   - Build command: `npm run build`
   - Publish directory: `.next`

2. **Deploy**
   - Connect your GitHub repository
   - Netlify will auto-detect Next.js
   - Click "Deploy"

---

## Railway

### Steps

1. **Create New Project**
   - Connect GitHub repository
   - Railway will auto-detect Next.js

2. **Configuration**
   - No additional configuration needed
   - Railway will use the Dockerfile if present

3. **Deploy**
   - Click "Deploy"
   - Railway will build and deploy automatically

---

## Docker Deployment

### Build Image

```bash
docker build -t llms-txt-generator .
```

### Run Container

```bash
docker run -p 3000:3000 llms-txt-generator
```

### Docker Compose (Recommended)

The project includes a `docker-compose.yml` file for easier orchestration.

**Start the application:**

```bash
docker-compose up -d
```

**View logs:**

```bash
docker-compose logs -f
```

**Stop the application:**

```bash
docker-compose down
```

**Rebuild after changes:**

```bash
docker-compose up -d --build
```

---

## Self-Hosted (VPS/Cloud)

### Prerequisites

- Node.js 18+ installed
- PM2 or similar process manager

### Steps

1. **Clone Repository**

   ```bash
   git clone https://github.com/yourusername/llm-txt.git
   cd llm-txt
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Build**

   ```bash
   npm run build
   ```

4. **Start with PM2**

   ```bash
   npm install -g pm2
   pm2 start npm --name "llms-txt" -- start
   pm2 save
   pm2 startup
   ```

5. **Configure Nginx (Optional)**

   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

---

## Post-Deployment

### Verify Deployment

1. Visit your deployed URL
2. Test generating an llms.txt file
3. Verify download and copy functionality

### Monitor Performance

- Check build logs for any errors
- Monitor API response times
- Set up error tracking (Sentry recommended)

### Update Deployment

**Vercel/Netlify/Railway:**

- Simply push to GitHub
- Automatic deployment will trigger

**Docker:**

```bash
docker build -t llms-txt-generator .
docker stop llms-txt-container
docker rm llms-txt-container
docker run -d -p 3000:3000 --name llms-txt-container llms-txt-generator
```

**Self-Hosted:**

```bash
git pull
npm install
npm run build
pm2 restart llms-txt
```

---

## Troubleshooting

### Build Fails

1. Check Node.js version (18+ required)
2. Clear cache: `rm -rf .next node_modules && npm install`
3. Check build logs for specific errors

### Runtime Errors

1. Check server logs
2. Verify environment variables
3. Test locally first: `npm run dev`

### Performance Issues

1. Enable caching in production
2. Consider adding rate limiting
3. Monitor memory usage

---

## Production Checklist

- [ ] Tests passing (`npm run test`)
- [ ] Build succeeds (`npm run build`)
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] No linting errors (`npm run lint`)
- [ ] README updated with deployment URL
- [ ] Screenshots added to README
- [ ] Custom domain configured (optional)
- [ ] Error tracking set up (optional)
- [ ] Analytics configured (optional)
