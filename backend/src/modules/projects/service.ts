export const projectsService = {
  async list() {
    return []
  },

  async getById(id: string) {
    return { id }
  },

  async create(data: Record<string, unknown>) {
    return data
  },

  async update(id: string, data: Record<string, unknown>) {
    return { id, ...data }
  },

  async remove(id: string) {
    return { id }
  },
}
