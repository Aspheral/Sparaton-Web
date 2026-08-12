import type { ProjectRecord } from '@sparaton/types';

export const kayChess: ProjectRecord = {
  name: 'Kay Chess',
  slug: 'kay-chess',
  organization: 'Aspheral Softworks',
  creators: ['Aspheral'],
  summary: 'An actively developed chess engine project exploring search, evaluation, hardware-aware tuning, and engine engineering.',
  status: 'in-development',
  flags: ['featured', 'highlighted', 'experimental'],
  categories: ['Chess engine', 'Software engineering', 'Research'],
  technologies: ['C#', '.NET 8', 'UCI'],
  repository: 'https://github.com/Aspheral/Kay-Chess',
  metrics: [
    {
      key: 'estimated-elo-auto-tune',
      label: 'Estimated Elo',
      value: '~2521',
      qualifier: 'Local Auto Tune estimate; not a universal rating',
      status: 'provisional',
      source: 'User-supplied Kay development record'
    },
    {
      key: 'estimated-elo-one-thread',
      label: 'One-thread estimate',
      value: '~2384',
      qualifier: 'Local estimate',
      status: 'provisional',
      source: 'User-supplied Kay development record'
    },
    {
      key: 'auto-tune-nps',
      label: 'Observed Auto Tune throughput',
      value: '~11.9M NPS',
      qualifier: 'Ryzen 7 8700F, 16 threads / 512 MiB; diagnostic only, not playing strength',
      status: 'measured',
      source: 'User-supplied Kay hardware-auto development record'
    }
  ]
};

export const organizations = [
  {
    name: 'Sparaton Studios',
    slug: 'sparaton-studios',
    relationship: 'Parent creative organization',
    summary: 'A creative works organization built around direct collaboration between capable specialists and the people who need their work.'
  },
  {
    name: 'Aspheral Softworks',
    slug: 'aspheral-softworks',
    relationship: 'Sparaton sub-brand',
    summary: 'Software engineering, machine learning, research-oriented software, and unusual technical projects.'
  },
  {
    name: 'Lattice Forge',
    slug: 'lattice-forge',
    relationship: 'Associated organization',
    summary: 'The group associated with ILMP media technology research and development.'
  }
] as const;

export const services = [
  ['Story & Worldbuilding', 'Narrative foundations, settings, histories, systems, and the connective tissue that makes a fictional world coherent.'],
  ['Character Development', 'Character concepts, motivations, relationships, arcs, and supporting creative direction.'],
  ['Lore Development', 'Structured lore work for projects that need depth without losing clarity or internal consistency.'],
  ['Illustration & Sketch Work', 'Rough digital artwork, concept sketches, and visual exploration for early-stage ideas.'],
  ['Vector / SVG Work', 'Clean vector assets and rough SVG artwork for interfaces, identity work, diagrams, and project needs.'],
  ['Technical Collaboration', 'Direct access to specialized technical contributors when a creative project crosses into software or experimental engineering.'],
  ['Specialist Commissions', 'Flexible commissioned work matched to the creator or team best suited to the request.']
] as const;
