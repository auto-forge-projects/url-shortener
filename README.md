# url-shortener

AutoForge ile üretilen proje (repo-per-project).

- Pipeline durumu: `pipeline-state.json`
- Deploy config: `deploy.json` (enabled:true — auto-deploy varsayılan açık; kapatmak için dashboard "Deploy'u kapat")
- SSH-push deploy: `.github/workflows/deploy-image.yml` + `deploy/remote-deploy.sh`
- CI/Actions: pipeline bitene kadar susturulur (`.githooks/commit-msg` her commit'e `[skip ci]` ekler); Faz 16 kapanışında `.pipeline-complete` işareti oluşunca CI+deploy normal koşar.
