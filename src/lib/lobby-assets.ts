// Mapeamento e URLs públicas seguras de assets do jogo:
// - 6 Avatares de Manager (Manager.pdf e pasta Dropbox)
// - Logos de Equipes (Equipes.pdf e pasta Dropbox)
// - Modelos de Carro (Carro1 a Carro5 para equipe personalizada)

export interface ManagerAvatarAsset {
  id: string
  number: number
  title: string
  filename: string
  dropboxUrl: string
}

export const MANAGER_AVATAR_ASSETS: ManagerAvatarAsset[] = [
  {
    id: 'estrategista',
    number: 1,
    title: 'O Estrategista',
    filename: '01-Estrategista.png',
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/us1odvwyg5fika5v93cp2/ANa1G4wrjfMjDpOX1cbHCBM/01-Estrategista.png?rlkey=g7j5jucdc3rhdvv7211cfsuu1&dl=1',
  },
  {
    id: 'competidor',
    number: 2,
    title: 'O Competidor',
    filename: '02-Competidor.png',
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/us1odvwyg5fika5v93cp2/AHRM1kX4g0hdpug4iD7J6gk/02-Competidor.png?rlkey=g7j5jucdc3rhdvv7211cfsuu1&dl=1',
  },
  {
    id: 'engenheiro',
    number: 3,
    title: 'O Engenheiro',
    filename: '03-Engenheiro.png',
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/us1odvwyg5fika5v93cp2/AIlU1g5tLGEU4Fm-HM3McVc/03-Engenheiro.png?rlkey=g7j5jucdc3rhdvv7211cfsuu1&dl=1',
  },
  {
    id: 'gestor',
    number: 4,
    title: 'O Gestor',
    filename: '04-Gestor.png',
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/us1odvwyg5fika5v93cp2/AGbFqK-fLlHG1VqtCCoX1js/04-Gestor.png?rlkey=g7j5jucdc3rhdvv7211cfsuu1&dl=1',
  },
  {
    id: 'empresario',
    number: 5,
    title: 'O Empresário',
    filename: '05-Empresário.png',
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/us1odvwyg5fika5v93cp2/AHmp368NtSG3cwf_cndqqFA/05-Empres%C3%A1rio.png?rlkey=g7j5jucdc3rhdvv7211cfsuu1&dl=1',
  },
  {
    id: 'lider',
    number: 6,
    title: 'A Líder',
    filename: '06-Lider.png',
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/us1odvwyg5fika5v93cp2/ANcmAfQXvz3R0UYLZL42APs/06-Lider.png?rlkey=g7j5jucdc3rhdvv7211cfsuu1&dl=1',
  },
]

export const CAR_MODEL_ASSETS = [
  {
    id: 'Carro1',
    name: 'Modelo Aço Escovado / Conceito 1',
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/6jgy9mlbhc65lwk657q3t/AJ1NShrXSqEUQ-vAxdle1Yk/Carro1.png?rlkey=065e9g795k7eh1tvrvwwd8fyo&dl=1',
  },
  {
    id: 'Carro2',
    name: 'Modelo Asa Alfa / Conceito 2',
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/6jgy9mlbhc65lwk657q3t/ABVGJE2I33GSZU-vJjUurHk/Carro2.png?rlkey=065e9g795k7eh1tvrvwwd8fyo&dl=1',
  },
  {
    id: 'Carro3',
    name: 'Modelo Velocitá / Conceito 3',
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/6jgy9mlbhc65lwk657q3t/AOb9iAOcaKCCO5QSUVxNsFw/Carro3.png?rlkey=065e9g795k7eh1tvrvwwd8fyo&dl=1',
  },
  {
    id: 'Carro4',
    name: 'Modelo Fênix / Conceito 4',
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/6jgy9mlbhc65lwk657q3t/AFRDu-0fF1ap81AVRExeySk/Carro4.png?rlkey=065e9g795k7eh1tvrvwwd8fyo&dl=1',
  },
  {
    id: 'Carro5',
    name: 'Modelo Vórtice / Conceito 5',
    dropboxUrl:
      'https://www.dropbox.com/scl/fo/6jgy9mlbhc65lwk657q3t/ANP1ScSk83fIidWhZa92m60/Carro5.png?rlkey=065e9g795k7eh1tvrvwwd8fyo&dl=1',
  },
]

// Mapeamento das 26 logos de equipes presentes no Dropbox
export const TEAM_LOGOS_MAP: Record<string, string> = {
  alfaromeo:
    'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/ANir-8SjJtE7iot1pQIi8i4/Alfa_Romeo.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
  alphatauri:
    'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/AGbAjEA839MCEsT_z3Et9bs/Alfa_Tauri.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
  alpine:
    'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/APZwbknFDUfH-UAywFuYu0Q/Alpine.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
  andretti:
    'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/ACUHOwkZ-IWUxqWpQr9LDl4/Andretti.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
  astonmartin:
    'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/AIQmaBVXSu5Mew9NfscybVI/Aston_Martin.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
  audi: 'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/AF3MGgkE232B6Xfpe20mxEk/Audi.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
  benetton:
    'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/AJZ3kUfA-pOTIY8G1SyXf1A/Benetton.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
  byd: 'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/AM2ryyQR9HksDevR18JMhaQ/BYD.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
  copersucar:
    'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/AEzT6WaI2TedfmoQc28otGo/Copersucar.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
  ferrari:
    'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/AJdZ5IlvncA__FBlCcvyB94/Ferrari.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
  fittipaldi:
    'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/AEQfu-RkS_fem_a8jp6p5FU/Fittipapdi.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
  haas: 'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/AOVhQwCBY0qxXnsqHavDlvc/Haas.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
  honda:
    'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/AIdug8dCg49zVEaFU0UuG40/Honda.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
  jordan:
    'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/AOAexVQg5LkLugUIQAK2BN8/Jordan.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
  lamborghini:
    'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/AC6PNK3F4ybgJ32B63yclD0/Lamborguini.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
  lotus:
    'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/ANjYXUx8bXksla9a6UnZZLM/Lotus.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
  mclaren:
    'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/AKDZwT8xRAmS12hMdcOgxT4/McLAren.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
  mercedes:
    'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/AKKbQRwwpUzmflvtMz6WRQc/Mercedes.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
  penske:
    'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/ALBAZ6qE2bHOhv0r5NcnhlM/Penske.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
  porsche:
    'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/AF4fH2juWGGpvrHjDWzN5LU/Porshe.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
  racingbulls:
    'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/AJM78PKZj2hlAAwKUZU43ho/Racing_Bulls.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
  redbull:
    'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/AGKPAkQU-jtPpGpVh91UdJU/Red_Bull.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
  renault:
    'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/AOAXga77BD2lRw_QcPL3RK4/Renaut.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
  sauber:
    'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/AFlc71e-nnFh7LXGni1MXME/Sauber.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
  toleman:
    'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/AKPdb3S1FD_YLNhiITyAKmw/Tolerman.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
  williams:
    'https://www.dropbox.com/scl/fo/ydtmveudv8i1tyvntggnp/AFrv26DFUkw8C4-QdgNB-J0/Williams.png?rlkey=fddnrl5qj9wsejc6aaf9pmxq7&dl=1',
}

export function getTeamLogoUrl(teamKey: string): string | undefined {
  const normalized = teamKey.toLowerCase().replace(/[^a-z0-9]/g, '')
  return TEAM_LOGOS_MAP[normalized] || TEAM_LOGOS_MAP[teamKey]
}
