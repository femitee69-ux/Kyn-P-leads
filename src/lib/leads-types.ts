export interface GeneratedLead {
  name: string
  email: string
  company: string
  position: string
  message: string
  followUpMessage?: string
}

export interface CampaignInput {
  country: string
  brand: string
  service: string
}
