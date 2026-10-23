import { Company, Project, Application, TenantContextScope } from '../domain/tenancy.js';

export class TenancyManager {
  private companies: Map<string, Company> = new Map();
  private projects: Map<string, Project> = new Map();
  private applications: Map<string, Application> = new Map();

  public createCompany(name: string, brandVoice: any): Company {
    const id = (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
      ? globalThis.crypto.randomUUID()
      : 'c' + Math.random().toString(36).substring(2, 9);
    const company: Company = {
      id,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      brandVoice: {
        tone: brandVoice.tone || ['Professional'],
        primaryKeywords: brandVoice.primaryKeywords || [],
        negativeKeywords: brandVoice.negativeKeywords || [],
        targetAudienceSummary: brandVoice.targetAudienceSummary || '',
        guidelines: brandVoice.guidelines || '',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.registerCompany(company);
    return company;
  }

  public createProject(companyId: string, name: string, icpDescription: string, contentPillars: string[], defaultGoals: string[] = []): Project {
    const id = (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
      ? globalThis.crypto.randomUUID()
      : 'p' + Math.random().toString(36).substring(2, 9);
    const project: Project = {
      id,
      companyId,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      icpDescription,
      contentPillars,
      defaultGoals,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.registerProject(project);
    return project;
  }

  public createApplication(projectId: string, companyId: string, name: string, connectedPlatforms: any[]): Application {
    const id = (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
      ? globalThis.crypto.randomUUID()
      : 'a' + Math.random().toString(36).substring(2, 9);
    const app: Application = {
      id,
      projectId,
      companyId,
      name,
      connectedPlatforms,
      activeCampaignCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.registerApplication(app);
    return app;
  }

  public registerCompany(company: Company): void {
    this.companies.set(company.id, company);
  }

  public registerProject(project: Project): void {
    if (!this.companies.has(project.companyId)) {
      throw new Error(`Company with id ${project.companyId} does not exist.`);
    }
    this.projects.set(project.id, project);
  }

  public registerApplication(app: Application): void {
    const project = this.projects.get(app.projectId);
    if (!project) {
      throw new Error(`Project with id ${app.projectId} does not exist.`);
    }
    if (project.companyId !== app.companyId) {
      throw new Error(`Context Mismatch: Application companyId does not match Project companyId.`);
    }
    this.applications.set(app.id, app);
  }

  public getScopedContext(scope: TenantContextScope): {
    company: Company;
    project: Project;
    application: Application;
  } {
    const company = this.companies.get(scope.companyId);
    if (!company) throw new Error(`Scoped Company not found: ${scope.companyId}`);

    const project = this.projects.get(scope.projectId);
    if (!project) throw new Error(`Scoped Project not found: ${scope.projectId}`);
    if (project.companyId !== company.id) {
      throw new Error(`Security Violation: Project ${project.id} does not belong to Company ${company.id}`);
    }

    const application = this.applications.get(scope.applicationId);
    if (!application) throw new Error(`Scoped Application not found: ${scope.applicationId}`);
    if (application.projectId !== project.id || application.companyId !== company.id) {
      throw new Error(`Security Violation: Application ${application.id} is out of context bounds.`);
    }

    return { company, project, application };
  }

  public getCompany(id: string): Company | undefined {
    return this.companies.get(id);
  }

  public getProject(id: string): Project | undefined {
    return this.projects.get(id);
  }

  public getApplication(id: string): Application | undefined {
    return this.applications.get(id);
  }
}
