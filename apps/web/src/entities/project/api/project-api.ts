import {requestJson} from "@/shared/api/http-client";
import type {Project} from "@/entities/project/model/types";

export function fetchProjects() {
  return requestJson<Project[]>("/projects");
}
