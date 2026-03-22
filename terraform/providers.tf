terraform {
  required_version = ">= 1.9"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
    turso = {
      source  = "turso-dev/turso"
      version = "~> 0.1"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

provider "turso" {
  api_token    = var.turso_api_token
  organization = var.turso_organization
}
