resource "turso_database" "main" {
  name         = var.worker_name
  group        = var.turso_group
  organization = var.turso_organization
}

resource "turso_database_token" "worker" {
  organization = var.turso_organization
  database     = turso_database.main.name
  expiration   = "never"
  authorization = "full-access"
}
