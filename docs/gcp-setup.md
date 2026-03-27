# GCP Setup Runbook

One-time setup for deploying Game Finder to Google Cloud Platform. Replace placeholder values before running.

## Variables

Set these before running any commands:

    export PROJECT_ID=your-project-id
    export REGION=us-central1
    export REPO_NAME=game-finder
    export DB_INSTANCE=game-finder-db
    export DB_NAME=game_finder
    export DB_USER=gamefinder
    export DB_PASSWORD=your-secure-password
    export GITHUB_ORG=evanstern
    export GITHUB_REPO=game-finder

## 1. Enable APIs

    gcloud services enable \
      run.googleapis.com \
      sqladmin.googleapis.com \
      artifactregistry.googleapis.com \
      iamcredentials.googleapis.com \
      --project $PROJECT_ID

## 2. Create Artifact Registry Repository

    gcloud artifacts repositories create $REPO_NAME \
      --repository-format=docker \
      --location=$REGION \
      --project=$PROJECT_ID

## 3. Create Cloud SQL Instance

    gcloud sql instances create $DB_INSTANCE \
      --database-version=POSTGRES_16 \
      --tier=db-f1-micro \
      --region=$REGION \
      --project=$PROJECT_ID

This takes a few minutes.

## 4. Create Database and User

    gcloud sql databases create $DB_NAME \
      --instance=$DB_INSTANCE \
      --project=$PROJECT_ID

    gcloud sql users create $DB_USER \
      --instance=$DB_INSTANCE \
      --password=$DB_PASSWORD \
      --project=$PROJECT_ID

## 5. Create Service Account

    gcloud iam service-accounts create game-finder-runner \
      --display-name="Game Finder Cloud Run" \
      --project=$PROJECT_ID

    gcloud projects add-iam-policy-binding $PROJECT_ID \
      --member="serviceAccount:game-finder-runner@$PROJECT_ID.iam.gserviceaccount.com" \
      --role="roles/cloudsql.client"

## 6. Set Up Workload Identity Federation

    # Create pool
    gcloud iam workload-identity-pools create github-pool \
      --location=global \
      --display-name="GitHub Actions Pool" \
      --project=$PROJECT_ID

    # Create provider
    gcloud iam workload-identity-pools providers create-oidc github-provider \
      --location=global \
      --workload-identity-pool=github-pool \
      --display-name="GitHub Provider" \
      --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
      --attribute-condition="assertion.repository=='$GITHUB_ORG/$GITHUB_REPO'" \
      --issuer-uri="https://token.actions.githubusercontent.com" \
      --project=$PROJECT_ID

    # Create deploy service account
    gcloud iam service-accounts create github-deployer \
      --display-name="GitHub Actions Deployer" \
      --project=$PROJECT_ID

    # Grant required roles to deployer
    for ROLE in roles/artifactregistry.writer roles/run.developer roles/cloudsql.client roles/iam.serviceAccountUser; do
      gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:github-deployer@$PROJECT_ID.iam.gserviceaccount.com" \
        --role="$ROLE"
    done

    # Allow GitHub Actions to impersonate the deployer
    gcloud iam service-accounts add-iam-policy-binding \
      github-deployer@$PROJECT_ID.iam.gserviceaccount.com \
      --role="roles/iam.workloadIdentityUser" \
      --member="principalSet://iam.googleapis.com/projects/$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')/locations/global/workloadIdentityPools/github-pool/attribute.repository/$GITHUB_ORG/$GITHUB_REPO" \
      --project=$PROJECT_ID

## 7. Get WIF Provider Resource Name

    gcloud iam workload-identity-pools providers describe github-provider \
      --location=global \
      --workload-identity-pool=github-pool \
      --format='value(name)' \
      --project=$PROJECT_ID

Save this output. It looks like:
`projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider`

## 8. Configure GitHub Repository

In your GitHub repo settings, add these:

**Variables** (Settings > Secrets and Variables > Actions > Variables):
- `GCP_PROJECT_ID`: your project ID
- `GCP_REGION`: `us-central1` (or your chosen region)
- `GCP_WIF_PROVIDER`: the provider resource name from step 7
- `GCP_SERVICE_ACCOUNT`: `github-deployer@$PROJECT_ID.iam.gserviceaccount.com`
- `CLOUD_SQL_INSTANCE`: `$PROJECT_ID:$REGION:$DB_INSTANCE`

**Secrets** (Settings > Secrets and Variables > Actions > Secrets):
- `DB_NAME`: your database name
- `DB_USER`: your database user
- `DB_PASSWORD`: your database password

## 9. Initial Deploy

Run the first deploy by pushing to main. The deploy workflow will:
1. Build and push images
2. Run migrations against Cloud SQL
3. Deploy server (creates the Cloud Run service)
4. Capture server URL and deploy web

After the first successful deploy, note the URLs:

    gcloud run services describe game-finder-server --region=$REGION --format='value(status.url)'
    gcloud run services describe game-finder-web --region=$REGION --format='value(status.url)'
