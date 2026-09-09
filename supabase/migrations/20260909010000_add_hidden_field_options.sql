-- Built-in role and location suggestions do not have database rows, so a
-- per-user tombstone is needed when someone removes one from their list.
alter table user_field_options
  add column hidden boolean not null default false;
