# AWS EC2 deployment for DocuMind

This guide deploys the app on a single EC2 instance using Docker Compose and the project’s existing compose file.

## 1. Launch an EC2 instance

- AMI: Ubuntu 22.04 LTS
- Instance type: t3.small or larger
- Security group:
  - Port 22 from your IP
  - Port 80 and 443 from the internet if you terminate TLS at the instance
  - Port 8080 from the internet for the app UI
  - Port 8000 only if you want direct API access
- Storage: 20 GB minimum

## 2. Install Docker and Compose

On the EC2 instance:

```bash
chmod +x /path/to/deploy/aws/ec2-setup.sh
/path/to/deploy/aws/ec2-setup.sh
```

Log out and log back in so the Docker group change takes effect.

## 3. Prepare the project

Copy the repo to the EC2 instance into `/opt/rag-app`.

```bash
sudo mkdir -p /opt/rag-app
sudo chown $USER:$USER /opt/rag-app
scp -r . ec2-user@<EC2_IP>:/opt/rag-app
```

Create the production environment file from the example:

```bash
cp /opt/rag-app/deploy/aws/.env.production.example /opt/rag-app/backend/.env
```

Then update the values in `/opt/rag-app/backend/.env`.

## 4. Update the app origin

Set `CLIENT_ORIGIN` in the backend `.env` to the EC2 public URL or your CloudFront/ALB URL.

For a direct EC2 deployment:

```env
CLIENT_ORIGIN=http://<EC2_PUBLIC_IP>:8080
```

For HTTPS behind a load balancer:

```env
CLIENT_ORIGIN=https://your-domain.com
```

## 5. Start the application

```bash
cd /opt/rag-app
chmod +x deploy/aws/start-aws-app.sh
deploy/aws/start-aws-app.sh
```

## 6. Verify the app

```bash
curl http://localhost:8080/health
curl http://localhost:8000/health
```

If both succeed, the app is running.

## 7. Optional production improvements

- Put the app behind an ALB or Nginx reverse proxy with HTTPS
- Store uploads in S3 instead of local disk
- Move MongoDB to Atlas or managed MongoDB
- Add CloudWatch alarms, log shipping, and auto-restarts
- Put Docker logs and app logs under `/var/log`

## Recommended production architecture

- EC2 instance hosts the app containers
- MongoDB Atlas handles the database
- S3 handles uploaded PDFs
- CloudFront or ALB terminates HTTPS
- Route 53 provides DNS

This is the simplest AWS deployment path for this app while keeping the current Docker-based architecture intact.
