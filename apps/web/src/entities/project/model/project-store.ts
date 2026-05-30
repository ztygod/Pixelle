import {create} from "zustand";
import type {Project} from "@/entities/project/model/types";

interface ProjectState {
  activeProjectId?: Project["id"];
  projectsById: Record<string, Project>;
  setActiveProject: (project: Project) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projectsById: {},
  setActiveProject: (project) =>
    set((state) => ({
      activeProjectId: project.id,
      projectsById: {...state.projectsById, [String(project.id)]: project},
    })),
}));
