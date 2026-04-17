# 🚀 Deploy StreamVault - Guía Rápida

## Opción 1: Netlify CLI (Recomendado)

```bash
# 1. Instalar Netlify CLI
npm install -g netlify-cli

# 2. Navegar a la carpeta
cd emprende-digital-pack

# 3. Deployar (te dará un link temporal)
netlify deploy --prod --dir=.

# 4. Login si pide
netlify login
```

## Opción 2: Drag & Drop

1. Ve a https://app.netlify.com/drop
2. Arrastra la carpeta `emprende-digital-pack`
3. ¡Listo! Obtén un link público instantáneamente

## Opción 3: GitHub + Netlify (Más profesional)

1. Crear nuevo repo en GitHub: `streamvault-catalog`
2. Push el código:
```bash
cd emprende-digital-pack
git init
git add index.html series-catalog.html netlify.toml
git commit -m "Initial StreamVault catalog"
git branch -M main
git remote add origin https://github.com/promarket08/streamvault-catalog.git
git push -u origin main
```
3. Ir a https://app.netlify.com → New site from Git
4. Conectar tu repo de GitHub
5. Deploy automático ✓

## Después del Deploy

Comparte el link con Roberto para que lo use como página de catálogo.
