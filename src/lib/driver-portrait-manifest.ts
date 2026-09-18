/**
 * Manifesto Canônico de Retratos de Pilotos do Google Drive
 * Abrange as 4 pastas públicas (A, B, C, D) e o catálogo de retratos fictícios.
 *
 * Pastas de Origem:
 * - A: 16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD (Pilotos1)
 * - B: 1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG (Pilotos2)
 * - C: 1VnsvoBZjLzK1G2rNwycroaixLVfITnvE (Pilotos3)
 * - D: 1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m (Pilotos4)
 * - Fictícios: 1q6BV-10CLvFhDdJM9dWNLkcT5a9Z803C (Pilotos_sem_nome)
 *
 * Todas as entradas preservam URLs lh3 CDN com resolução total =s0
 * e link direto para o File ID do Drive.
 */

import { DRIVE_STORAGE_PHOTOS, getDriveStoragePhotoUrl } from '@/lib/drive-storage-photos'
import { FICTIONAL_PORTRAITS_CATALOG, FictionalPortraitAsset } from '@/lib/fictional-driver-catalog'
import { matchEntity, MatchCandidate, normalizeCleanName } from '@/lib/entity-matcher'

export interface DriverPortraitEntry {
  fileId: string
  originalFilename: string
  sourceFolder: string
  category: 'pilot_registered' | 'fictional_portrait'
  displayUrl: string
  thumbnailUrl: string
  entityId?: string
  entityName?: string
  matchMethod?: 'exact_id' | 'exact_normalized' | 'alias' | 'fuzzy_approximation' | 'manual'
  matchScore?: number
}

/**
 * Inventário completo e validado das Pastas A, B, C, D
 */
export const DRIVE_REGISTERED_PORTRAITS: DriverPortraitEntry[] = [
  // --- PASTA A (16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD) ---
  {
    fileId: '1frK_p_VvrfMmcPRyryq-XBJ6fAXBuu_q',
    originalFilename: '05-Gabriel_Bortoleto.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNAiVOVVlm-NI48v7V1oTftHvOiMCLOFpx1ZrF6UWrTobhCbyRxbX6f-rzEXoovZapXxeneVbTOxN443QjlrMn_hCj9tZ9FB0Qsm2Op=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1frK_p_VvrfMmcPRyryq-XBJ6fAXBuu_q&sz=w800',
  },
  {
    fileId: '1uRGxtEf33A0UhkGPLoRck1YOVaXTWAEk',
    originalFilename: '1-Dino_Beganovic.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOMpOlek7KnpqXow073h5CIGHkIqn7MiP99iQzYTP9rtjuBGTOB6RV7oXLJpBePdJCMBQ5z1JPtzd15yYET_ZrXAuIlJg6EVaZhKU42=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1uRGxtEf33A0UhkGPLoRck1YOVaXTWAEk&sz=w800',
  },
  {
    fileId: '1Rx1OI-5a7NfxO34M7PrtOLj6d9_-KJtG',
    originalFilename: '1-Rafael_Camara.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPVrJAwJHGFzPi7CMjNtEB-VMdZKxcjy_RmtqLaf5Bno9PLsoXv4fFD5jUy4GmKSOPZk4heAC0YCfL_IvxiX2SU2K8syGS16DozWG2A=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1Rx1OI-5a7NfxO34M7PrtOLj6d9_-KJtG&sz=w800',
  },
  {
    fileId: '1c_BWxuuVGJFAtlKE_jq4ynDibOQgu9bx',
    originalFilename: '1-Ross_Chastain.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOCnF6LhvgsuevgD9a-dWP_XFzFvY19M9yqpsrxODuvSyOMAVwhU9kR5scsRLOFZWLfEUW7Z6YMW6qGV1W8RoyQbGKRIItFTSA5L7_4=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1c_BWxuuVGJFAtlKE_jq4ynDibOQgu9bx&sz=w800',
  },
  {
    fileId: '1-3F3osjuThj6hi0WV9y-phX8Y3D9MOiU',
    originalFilename: '2-Josef_Newgarden.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPylzSkLtEbVPtykmsMRft_8cDYjaleuW23j2jH2sFfxfAmzOnxjXpSLpQPM_6oPZlVMglmqgbAJIUkExtyxQXiqvFsZg54EjUmsf-V=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1-3F3osjuThj6hi0WV9y-phX8Y3D9MOiU&sz=w800',
  },
  {
    fileId: '1soq6XrSWXNu7YiDCZ4Y4y6VB-3fxXqk1',
    originalFilename: '3-Daniel_Ricciardo.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOXV08uN0DIKP1H0BMNIVU1eK9gTc8iMiAe1orwTznUto72jhuH3-P2TPSxW99yHlwDNDEoZ9qaExFKnmK3yv6OJfykt5OHFNpaCbbE=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1soq6XrSWXNu7YiDCZ4Y4y6VB-3fxXqk1&sz=w800',
  },
  {
    fileId: '1Bffn8XMsRKjXsejqKQTBftpXY19PEwFT',
    originalFilename: '3-Max_Verstappen.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOJQlQeNaNcPrOlMaSbq-OTyscmoot_mgSNwG-qLP2tFWvG_k77KrMbir2C1dq8goaUczk4dUMBenmgS76x-UZC9bUFiI7alCmPhuk-=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1Bffn8XMsRKjXsejqKQTBftpXY19PEwFT&sz=w800',
  },
  {
    fileId: '1_Pq-eMAnV0GizlT8pto7U_KK0C7Favt-',
    originalFilename: '3-Nina_Gademan.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBP2kZJncTn5MXNirgS_KMUZRBjI8JQb2NUtDioTOvRXSkusNxjDWJa2J7_1P9_gut5gaqS_daH52H66nNHC-iIkFo83bU87I3E74PZQ=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1_Pq-eMAnV0GizlT8pto7U_KK0C7Favt-&sz=w800',
  },
  {
    fileId: '1mKq8yJuaBFs1uJmjtEo7xPxwCqPLjblk',
    originalFilename: '3-Paul_Aron.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPXcpqvYzZci4HY3VtGKv8h3XLoZh8XtdEQlimX7ykSRV4G6W5yjr46zr6GueZEFjGFTzaUTadxZaV-UBeTERtmgGrHXm-UA_kKJX2H=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1mKq8yJuaBFs1uJmjtEo7xPxwCqPLjblk&sz=w800',
  },
  {
    fileId: '1InFNN-J5S4Qbr00FkjEm9jHb7d9EI8po',
    originalFilename: '3-Scott_McLaughlin.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNxK5PM-86HKk4m-55wwDTQ-UlCUGntamzv5xRJZHfeacduix2s3Rj8Y4WHbtf6xp_VYFl7PG07gWYaIaLh8c571M-hf8FBxwwQUfb-=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1InFNN-J5S4Qbr00FkjEm9jHb7d9EI8po&sz=w800',
  },
  {
    fileId: '1pUE6onHBRQbB5d9FIKJ0efUdNEZ1MgeC',
    originalFilename: '4-Caio_Collet.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBN1Ao6H_EU6qI_AE15fe5eBoVtPiMD2_KlLRqIJloweZ1xb9kWxJOGKe3ctxkNCqBoKHgeHTdh8HndOCjbbjXURfn8Bimqy666NvSfF=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1pUE6onHBRQbB5d9FIKJ0efUdNEZ1MgeC&sz=w800',
  },
  {
    fileId: '1iMpvRT-HkR4VyR7LowH0DpDYa4xCef1F',
    originalFilename: '4-Lando_Noris.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNnJ_n6UiVvG8UU9Wnxn6S5m6WZRGGzyks_z4zABGXJsB12SBVP_oeNM6h_r3N8Sud4uE99y8Yws4fSR_dKdnRZ5okgF0vsgRqzogNq=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1iMpvRT-HkR4VyR7LowH0DpDYa4xCef1F&sz=w800',
  },
  {
    fileId: '1IIr-3DgsnLggoa8UJFF4etY1atujGwUh',
    originalFilename: '4-Megan_Bruce.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOVHjPSmP00OsUtn-umVAroYwpoz57G2PkwNorbHim-tWCnE_8-9G-yAmm2wozoZnw7Sn_LJDgrPI-yqBhp3ivgO7CWI0wqSCVAOeJS=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1IIr-3DgsnLggoa8UJFF4etY1atujGwUh&sz=w800',
  },
  {
    fileId: '146Er6Z4PxtC1MmgNiFc_cdz69DTnxMyR',
    originalFilename: '4-Santino_Ferrucci.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMXu_TQy2Z2jxCraR0DeNGd6CoNLh79rz8gGrOSvzrumC6swA_MUMhb_GQUJIMVop3NfqOPj_qZLQnsyE6r2osw9M_8xzoVooxZQ1Oq=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=146Er6Z4PxtC1MmgNiFc_cdz69DTnxMyR&sz=w800',
  },
  {
    fileId: '1iI6HMcj46bKSmdi-uSBWu4yz5ZMiax05',
    originalFilename: '5-Emma_Felbermayr.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMYjPKtgUG5L8_L9OCf1t2hEtS99V9u2o9Wy32MmVIunBWAkhbkINfrGEscmqp-iFuvl5aKdoNz7GYFXbxStZcUhtynv6GIF35aPUIV=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1iI6HMcj46bKSmdi-uSBWu4yz5ZMiax05&sz=w800',
  },
  {
    fileId: '1iX4Wn_mirQc-GBD5z0kpQaGvT1UznJi1',
    originalFilename: '5-Kyle_Larson.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOZZmdRVp_Bk711MIOEEPfsnA-yImMl4Os8ggC3Z02-CBKRPl53v0lS4BWeAyeGz83fm17pybdOZkgsyBBAljBsQaSxolQW6SPyEPlY=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1iX4Wn_mirQc-GBD5z0kpQaGvT1UznJi1&sz=w800',
  },
  {
    fileId: '1F-9PIIDAmIyi9y7nEwxogDxMoczL6l_b',
    originalFilename: '5-Sam_Bird.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMVJMVXmNs301lBeQxXdVdnjHLVN9CaOkUxvrq9UvNtYdvOVzqTypZ0Wlr042pkEfSHr2OYT6DTLDCsfJAQ-sY4TEfk_8BrJBqq8s3s=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1F-9PIIDAmIyi9y7nEwxogDxMoczL6l_b&sz=w800',
  },
  {
    fileId: '12QxgKmuEM0DvTX5IsppJAPOeAZ2TiJVl',
    originalFilename: '5-Stoffel_Vandoorne.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBObdvILozSsRd1b1kIWhwKONogaMC08VnIVHkBzGcM70eiA5fm-KMcq4_V5YiuER5URyAmU34x4hKkrgUaiKEOaNIsNC7nuZ5QMhh1X=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=12QxgKmuEM0DvTX5IsppJAPOeAZ2TiJVl&sz=w800',
  },
  {
    fileId: '1D0Jxw4rOEHg0eF9FvN7sHEpzUTheGdhC',
    originalFilename: '6-Andre_Lotterer.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPvQcN8Mt9SsEFSFjG-Y2y1xzor8A5B5Wf25oSSVp89HF-KUt6XXlONWfJC9l7qrbysXNG3Aohy1CWL9FMYlcyb8Mvr3YnRSgpZTPRD=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1D0Jxw4rOEHg0eF9FvN7sHEpzUTheGdhC&sz=w800',
  },
  {
    fileId: '1PMquSZRZRG7k0NT-YM-2987LTT8I7c6s',
    originalFilename: '6-Brad_Keselowski.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBM0ni0ZjpXGXbtEM3AGOihcWXKBUujhJAhfvy6dZRN86zKY9SStgV1lb1BZyAB2Ok4SCHBMNH_D1_sN_iUxHnmPp7tnxE1kVv3dQdp8=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1PMquSZRZRG7k0NT-YM-2987LTT8I7c6s&sz=w800',
  },
  {
    fileId: '10ULiymoncVtwFJh3SxTg6APDVgg_r9hE',
    originalFilename: '6-Isack_Hadjar.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMN0VCnrafYBPRHm8xJkY-VxqVz43RE-hXbgc0k2ZmcReu8yQHTBZrXunSH98gKiR6v7gXc-PG3acPmPtKQRzOev326YiGVRkixq1Bq=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=10ULiymoncVtwFJh3SxTg6APDVgg_r9hE&sz=w800',
  },
  {
    fileId: '17zUB9w2ij517POSpSRF4yk2dEH6-rrU9',
    originalFilename: '6-Nicola_Tsolov.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNzFdM5IbBk4Ff-7o5q4Twj3SuAK9igzlm_eXkKWDDwz9-YZQtqmuU1MHCaZeNNnQLlge9sM_aIrhLN1mHKmGNnAu_Hd8kqZmWqGqZw=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=17zUB9w2ij517POSpSRF4yk2dEH6-rrU9&sz=w800',
  },
  {
    fileId: '1oXqr5L-91LdfWYq6bZ-C_8QL7lPmjmLl',
    originalFilename: '6-Theo_Pourchaire.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBM0I_bfHKJpXmbo1-EKJCRWtavA_Np0aDlYGroSFExslDYDNck-B6cLsw4TaBM9uDCvBG96xcrfP61HEp8kQ_oXYfZQygdNgYzjmW_p=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1oXqr5L-91LdfWYq6bZ-C_8QL7lPmjmLl&sz=w800',
  },
  {
    fileId: '1qMZCBJzOH_kfHt8_S87epHbndy-BL8wX',
    originalFilename: '7-Alexander_Rossi.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNwxB1Hz9WB84Uru3MvFPYPl8zDbJGASl3kziP_tnK9udcaO6CzNQpRF52HS7E-LtDx1LxvArKEzWU_t2fx00p9jIr9dtqPWCnnVlU3=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1qMZCBJzOH_kfHt8_S87epHbndy-BL8wX&sz=w800',
  },
  {
    fileId: '1pQ6K0NxK7FyPwGb5fpUershs0C4WX44l',
    originalFilename: '7-Christian_Lundgaard.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPMKoAICjTl1RsOlYtQgncwv416IVYCHA2uLR14qzxjtQw7Rl9QAY8CHNzObiX78-2H-u5qUHgeirfhmB3Au8pJFXRZpIGvHSSqPXww=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1pQ6K0NxK7FyPwGb5fpUershs0C4WX44l&sz=w800',
  },
  {
    fileId: '1y21GquGMqZMq6s1L4o-o0eGBs8E6rkQL',
    originalFilename: '7-Jack_Doohan.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOgyWYpWNF5CpDMYoELDGlh6j04zCzO2z8LUukeIHDmAyfFEzZThWyIQJgGQddMq50dQVXtw2Toz3zLKVgxVG8tlD89f0LUaY-0nutR=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1y21GquGMqZMq6s1L4o-o0eGBs8E6rkQL&sz=w800',
  },
  {
    fileId: '1cDOoPmUtlzSCa863Usdwz-mx1cylxb3P',
    originalFilename: '7-Kamui_Kobayashi.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOtDchADSXl6Fd0YPmY4E2Fgq2wSxo-jtFsXQXuZl1vTzIThyke58CWnQGzz4KKQWkn7D5Zei86VlsVAtRPyydHRe2e_fgm6cZJo2z0=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1cDOoPmUtlzSCa863Usdwz-mx1cylxb3P&sz=w800',
  },
  {
    fileId: '1AXQ5h4myGbOvmOJKX7S-xbBAT6kWNiyR',
    originalFilename: '7-Maximilian_Gunther.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNB1Out1xSzyZTw_P4DCXCdn8IlP3_TBzLaXR54fFLFaKwrIfxLyGCReDKHIPO809P2q8qj4G04NNkswh0rEe56Fw25Tfu8tMY3Cnev=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1AXQ5h4myGbOvmOJKX7S-xbBAT6kWNiyR&sz=w800',
  },
  {
    fileId: '1_-Mg5GFHxJAzvDEpijNEFq_CQGefJQjJ',
    originalFilename: '8-Frederik_Vesti.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBO7aixlMPJwl9gLxFmIovBc4QDtQ-R9Rhs5fCXMV9_Lgo_up4QJ4EY36NbRIseB7fY1atbLtL_EdqV6KJ9xnHEEsFxcMOtsmDYgIVg5=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1_-Mg5GFHxJAzvDEpijNEFq_CQGefJQjJ&sz=w800',
  },
  {
    fileId: '1XZlgfL3z4XFsyGkg4cMYURn7ph1klvtv',
    originalFilename: '8-Marcus_Ericsson.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPDpQYVeffzYNK7-tkT_nVC0H_i7AobsJyZEOk5AelT9gXm-UvbMhyR93HwYcW32p-BjhlkX-Q07UFDOAt0DJoA_bmAwNLNnX5MVZ14=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1XZlgfL3z4XFsyGkg4cMYURn7ph1klvtv&sz=w800',
  },
  {
    fileId: '17Qk4csRx8Ac_Ey95nzVLuBgQh8L30KTJ',
    originalFilename: '8-Mathilda_Paatz.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNhE9tVXKKn7ekbXgZj_oJzPG-8lAZ3hALgWGw9-R4XWrJNNNMHn8UhUY5pqkEuJ5e826h1rTNPrAdK74e4tj_t4s6o9rZRxpC-DDCP=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=17Qk4csRx8Ac_Ey95nzVLuBgQh8L30KTJ&sz=w800',
  },
  {
    fileId: '19VOpZFz-0toL2z1CKT5ctGLuI3wHyF7n',
    originalFilename: '8-Nelson_Piquet_Jr.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPyvqZbqT9DiYeMeSe0Bbd-B3YVL0Qw8XdxAG9rCbHRPa4gWH1AiOnLEmAxtxSWdjoATZY64FPGhXAK9o7wZug-b_tFKsHDwhql9-p2=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=19VOpZFz-0toL2z1CKT5ctGLuI3wHyF7n&sz=w800',
  },
  {
    fileId: '10WpJWZF8VXwsdYuAcwUhsiV8SjA_SPtT',
    originalFilename: '8-Ryo_Hirakawa.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBONCkIOcadv3TZ_JUwl_g2igzIMY0rqhAZLLSFEGxJ2cIaTFkkCg-hXIdeTd9cppSlDj3ITKU-uFMJqQRDGd1-vdkf6YB_LV9mlk2AY=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=10WpJWZF8VXwsdYuAcwUhsiV8SjA_SPtT&sz=w800',
  },
  {
    fileId: '1f8qmNv-lz_7lVMbwb1UsFuwlcdmzaBJ1',
    originalFilename: '8-Sebastien_Buemi.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOisIuH0_pg7bKEhXS8EcmFCzn99dAbSbcCwl-KAzte7JMRPcPDJaScPw7mnFo-tS8-ZvtTt9hDtXbO7aQqq8HgjJr8hOSHWvhTwN6L=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1f8qmNv-lz_7lVMbwb1UsFuwlcdmzaBJ1&sz=w800',
  },
  {
    fileId: '1ejF6Qm_hGRQlDAbD858_3pK-Sw1_uGcc',
    originalFilename: '8-Victor_Martins.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPNbsSpw7G0w1A4Sf4jZNIV_rbXkijUI2ifs_8oAsTOlr8RcCLhaR3QW47cgJmX1Uu5jj4sY6QUh2N4jw0GzDaqyrl2b_ToHsvg0r0F=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1ejF6Qm_hGRQlDAbD858_3pK-Sw1_uGcc&sz=w800',
  },
  {
    fileId: '1o7Q5IvPcQMzgDikZYPawATg5pM6ceYJ4',
    originalFilename: '9-Alba_Larsen.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPkCd9SiDaXV9E7uEzJmlQnsO5D6T-F89nl7v4AjVkCFtcne8ynBzAly5Kubm7Tez8zOG2yiOPvyn3oui1nkA1FI9LMojmgWI4JVBK0=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1o7Q5IvPcQMzgDikZYPawATg5pM6ceYJ4&sz=w800',
  },
  {
    fileId: '1kQSx9Y9tYxyQsvj7OOYs2OB5v_f42OjX',
    originalFilename: '9-Chase_Elliott.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBO9DLpWfDAVTkW94hiYIYA18K75qST-nAXdRgQoA8bjLx7KaEwkJv1AUyQtFGhrfvJmU5so9KtzAVr_mB-yv4vZf5bSPMBjgkxgWXO9=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1kQSx9Y9tYxyQsvj7OOYs2OB5v_f42OjX&sz=w800',
  },
  {
    fileId: '14HTtC1Kb0qIzwpfYCf1pBsieJ52MQS-E',
    originalFilename: '9-Gabriel_Mini.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOl1pfwcmtlkNqYWaUJLyYW_xNTv4wcqcJAD_uMvlSwzB8Mux13fFEJG_-iPNlcNcE5Ws6SUVIoJ6_spsB7i9Yf9vHCZN8xI0WMRBWa=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=14HTtC1Kb0qIzwpfYCf1pBsieJ52MQS-E&sz=w800',
  },
  {
    fileId: '1iFZWf5Gu7rBXzIemN3gJpxblg6HXv2af',
    originalFilename: '9-Mitch_Evans.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNelQosODmipTS6Jl1IsSXLw9oWPrdZ8FTYDnCG61T3oUEqX-PKxJD_U7pMMZqsmPwaM175xifasLOpowJPpnhP5-uCxoEc_gtdwnyO=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1iFZWf5Gu7rBXzIemN3gJpxblg6HXv2af&sz=w800',
  },
  {
    fileId: '1RCBWH4bqdujKHDCso0QTVchsiAFyp-5y',
    originalFilename: '9-Payton_Westcott.jpg',
    sourceFolder: '16_j_jICr5z8Vqe5JOdP2tvgk-pHaoCWD',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPe_fYn0T6Mf8MyDj_ahmZMEWqRBiLGbRubYcTJWc3sZA3BIApVapWxxB8riy8yjTi21SPZzsgwlwt0q3XUu-Umx4NTbqMRfpWNSKoE=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1RCBWH4bqdujKHDCso0QTVchsiAFyp-5y&sz=w800',
  },

  // --- PASTA B (1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG) ---
  {
    fileId: '1UoyUOCiTCrjB5P1C76taybFtpRU3LVfh',
    originalFilename: '10-Alex_Palou.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBM4jCTXN0-Ey66YB10bLFDBuyQhKw6tKnmIQvdfHFKLScEjVZpcjNHxchXXnio0vzrz3d0GkVZyQEOSG87YJYMnJsghMK3t4NkxFTQ=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1UoyUOCiTCrjB5P1C76taybFtpRU3LVfh&sz=w800',
  },
  {
    fileId: '1Afuso77gJAB1y7kF-FOx0HaahKWxEwS1',
    originalFilename: '10-Felipe_Nasr.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOx-mfQ1OfnWoC2aFhGOEVjNLxUyoHYnaIW-OFjASvZYwqh0TOy9LpsREqnKvTpvdFK4m1WKt8i41p1mdSqnLGXPsJ8lv5M2RPHfgw=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1Afuso77gJAB1y7kF-FOx0HaahKWxEwS1&sz=w800',
  },
  {
    fileId: '1PFkZmRl7kLuyGam3cRwRG69HJCnl9To8',
    originalFilename: '10-Pierre_Gasly.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMfrBbEzeYVOHoN5QJ1s8IS3hiwth3JV38nH-J1wv8ysnEhJTB_sImp28gwoMkynZ7w02ArPwUMsM5-MRm0Qsv1jGWfhThuQgAu9Q8=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1PFkZmRl7kLuyGam3cRwRG69HJCnl9To8&sz=w800',
  },
  {
    fileId: '1qYvSSFJjRVF20KWFpqHp7if5dBYtgcV-',
    originalFilename: '11-Denny_Hamlin.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBO_z4vHvCdD-FQtu-fhCQHGa6t4VIHjjg1wVPw_mDxtkMOCSWLJenBHVcywhlchGkLRf76HEdTR0sxGz4WBluk4Gcy2Adk7S4CNK4U=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1qYvSSFJjRVF20KWFpqHp7if5dBYtgcV-&sz=w800',
  },
  {
    fileId: '1lEw8ZSdjz3TaJV6tF9U6IzvL7G0Xh-dh',
    originalFilename: '11-Lucas_di_Grassi.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNtDD4uxpqUSOx82ZXkCL3VH1CEJYI5nP7aefIkDJVU5TGOpPfMbqbQUjX5ilKwC6SSlsNEim4Tj_XmcqJtaaWqBKXxhwamYNHaW3E=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1lEw8ZSdjz3TaJV6tF9U6IzvL7G0Xh-dh&sz=w800',
  },
  {
    fileId: '1AfEEQJWj3jPU2P0UF9z2Q1TP2DEnehUb',
    originalFilename: '11-Rubens_Barrichello.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNlNEHv9bj9n8Lz5bCljPJVT_zTw1cz2rnbFGXHmeTmHLRE5n5sp4SuDs2yGworR1eu64tRcSzDPak5YWcxRVkoIxFdkUD0t_LOUNY=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1AfEEQJWj3jPU2P0UF9z2Q1TP2DEnehUb&sz=w800',
  },
  {
    fileId: '13rDRYcnk3rtC8H_wbQcg-CnA1MLufVCl',
    originalFilename: '11-Sergio_Pérez.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOKgGxbYCdBJ-mQOllWCwbFieCqpC9lwrlWaP6IhOs8Oia-PXxfxNx5lxOZZK-VzP_cc6NDVoGn8wM1W0BRW-Au0JWjldsk1Wk-4Is=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=13rDRYcnk3rtC8H_wbQcg-CnA1MLufVCl&sz=w800',
  },
  {
    fileId: '1sv4fRlhkQv6p7unF0t7a5scAmRN68KUc',
    originalFilename: '12-David_Malukas.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPfdJ0uR4zBbrxM-ivNy6PaAgP23AtZ14RsfV8hRkMFlRqWe7xRoHPVLsgSNiQu7BwYhS-PcY7C77lC6nshA1HzUvYhn-Yplt2TO5w=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1sv4fRlhkQv6p7unF0t7a5scAmRN68KUc&sz=w800',
  },
  {
    fileId: '1F79HYkf0HD-FrRVKeev98iY65iA5yEzs',
    originalFilename: '12-Kimi_Antonelli.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOKbx629iALtDq1NTIiwnsJENNauswNROMWkgcgIAI3FMX6NE_wrvgSHHNMPInbCmxk_4KZ5JsGIXZRHvc525yVmqhe6jLcvkKzqyw=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1F79HYkf0HD-FrRVKeev98iY65iA5yEzs&sz=w800',
  },
  {
    fileId: '1B5PwVSimd43yjaFFzo1DbkTa1VxEYJVu',
    originalFilename: '12-Laurens_Vanthoor.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBN5t915MtJR6f7LxCBUOrhK4xZ_Df7bVDTNxeWqhndhVeTe6ARFuXGloWtkaVgpjyVC89SvISvwMS6a82La9df2vanjT2GiCb8fGho=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1B5PwVSimd43yjaFFzo1DbkTa1VxEYJVu&sz=w800',
  },
  {
    fileId: '16iN4AUlKq9r4VrCENtwu7X7VLbOevF-h',
    originalFilename: '12-Ryan_Blaney.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPls56u_-tdAuLDsAQjb6waT5VCrwjMc46iS2kHQ_j3y7tTEB85-pAZFIiQOGuaWbfNeVLG4fgWRLGAPvIUEHSjQP3tNHZZYSk3_e8=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=16iN4AUlKq9r4VrCENtwu7X7VLbOevF-h&sz=w800',
  },
  {
    fileId: '1SZNBHMW1T1i12JZdZXq2-uKOoe4eBUH0',
    originalFilename: '12-Will_Power.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOBzHw7DyrkzMxy3EzqByYo9tUAcFAaqW8p7iD5w81nKTyWbWapajuFeDdCk20Vqs_JZAmzsxKKkNrtvGaZG6pog_gcjTlogoz6ihE=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1SZNBHMW1T1i12JZdZXq2-uKOoe4eBUH0&sz=w800',
  },
  {
    fileId: '17cXlx4HIAPIWTa8N8s0WiaGq-rWWBC53',
    originalFilename: '13-Antonio_Felix_da_Costa.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBP2sNagxnVyvuil8nSeQo6F2iyUxj1nREpiuMhFs2I7y-ByXagHhMRjJwk1gM9UQLAzovXiXZjvAbw_CBFyrfVx9OdXhnaADHT1vPM=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=17cXlx4HIAPIWTa8N8s0WiaGq-rWWBC53&sz=w800',
  },
  {
    fileId: '1Wg2B06fp77PBZmsVopQTbfCepjAtpjkh',
    originalFilename: '14-Fernando_Alonso.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOsJeVB7DuP3SalI2Y0nuAn5b38gPazTpes87_Znk4qsyq1-XGRuv3XhQVUE8sF9EoTa0K6IR9NxQeA8AJhTJ-VjsgzkdTwegmaCj4=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1Wg2B06fp77PBZmsVopQTbfCepjAtpjkh&sz=w800',
  },
  {
    fileId: '1jP1QCg9sW1BS2WzMwJmj2yBB5ni2oTBW',
    originalFilename: '16-Charles_Leclerc.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMtPvNGzC9aS3aiklfLpLIqnat1y6VKafsRVXrXHlwZ9wkM1AznKddCs0Kt7dEb7PzR7UGGEvw7P56JJAZTcC_dCw_tdi29SBAtBYM=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1jP1QCg9sW1BS2WzMwJmj2yBB5ni2oTBW&sz=w800',
  },
  {
    fileId: '1i2KsD94PyLVTXEEpH8QQsaFSey29A1Rr',
    originalFilename: '17-Lisa_Billard.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPjkPG1QghZSPF30ev1TUTftZs1Rtn1DSKJv9dLvqrOx8Mwx4EabQyXRKzyaAL2SV7ZhPRvtQUOZQ-FfkoygNGFFwXE9bNmTTwGWK4=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1i2KsD94PyLVTXEEpH8QQsaFSey29A1Rr&sz=w800',
  },
  {
    fileId: '1rQ82-3DyXVhRE5r7K9t_n4gzTrHzC8AG',
    originalFilename: '18-Alex_Dunne.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMDO7TxfAuyofhvvkcW4Bv1W7YBUc7ke8IlBMyTnv5NW0XJcrF0EGzIxiZC9irY8bdCVgOp2bHWCpAY45CXG6zCmGTygrg3GsMAYTk=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1rQ82-3DyXVhRE5r7K9t_n4gzTrHzC8AG&sz=w800',
  },
  {
    fileId: '1X_RSWdbEUgd_Nfpgrom9Bb8Or3TZmjdW',
    originalFilename: '18-Lance_Stroll.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOPKVGvEmFrlw5YgnCCM-f7GldTaIBFo4an88SyobpQH1nAPUvyQi68KTGOnprlwfyD9Y3wBoLorgmEex_F5ct8St1G3lpfuCpVAG0=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1X_RSWdbEUgd_Nfpgrom9Bb8Or3TZmjdW&sz=w800',
  },
  {
    fileId: '1yqSq0IT48PiJcYutbrq8qAT6txrZwshH',
    originalFilename: '18-Rafaela_Ferreira.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPUnxA_mr7eqrAQTgsNpkf_d58C0HF1Qno81X8TWB5FH95UhRTMXMiMW84y6VwqTJzWOsiycugA9T3SvCCNG8Ci50mOfz9yIMBjTxk=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1yqSq0IT48PiJcYutbrq8qAT6txrZwshH&sz=w800',
  },
  {
    fileId: '11QzMwMzvBKjvpGab-kAsZeltRMmwyyYN',
    originalFilename: '18-Sebastien_Bourdais.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOuZTTwZbg01wcMIKlhwl34HkMC8zk0zPRO_MCTUBB8c1BeZBf9u9khqBtEP9gz3uJfQRdO0dc7ayEXcJ-QNe2yOSO_0n49Zn82hR0=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=11QzMwMzvBKjvpGab-kAsZeltRMmwyyYN&sz=w800',
  },
  {
    fileId: '1MEufRRAqb8yvxn9tSQ1QWoZon16bhVty',
    originalFilename: '20-Christopher_Bell.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPM3HNF2bDIFQM9r_LiuBLmDYvltgRsVccCsduXsnM4aM5ieA3_hwseBqEihK2E5Y4nqHU5_EFlAj5fCm7XLoyNn9ud4eta14GoQ3I=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1MEufRRAqb8yvxn9tSQ1QWoZon16bhVty&sz=w800',
  },
  {
    fileId: '1iO3PPAeJcnLhrON5WReyL58OmxMU81Nt',
    originalFilename: '20-Kevin_Magnussen.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNh6fqBmgN5QM-2WBuXOJIXiZ3Co7aZtaISqSr4VFBf7Uindk1Gs5B4ySKQn-gmHzuV3ArN8hI0ytOjMyCgKKcGcDSDCxnzhGKPjU8=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1iO3PPAeJcnLhrON5WReyL58OmxMU81Nt&sz=w800',
  },
  {
    fileId: '1NV_YEKen8-TzzgjLGK13OLyxyz0XH3XN',
    originalFilename: '22-Joey_Logano.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNPga901YiU62BhAXaR9fXgplGQEtIhCvsykjARhT6pLzCjBI_TfSQQ7sTO55RLxJUP3d5v1C4U5qcYxpi0gs5mJ3DejyosXp4MJzU=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1NV_YEKen8-TzzgjLGK13OLyxyz0XH3XN&sz=w800',
  },
  {
    fileId: '1y3LDEVkws2OYEbjWst3T_O94yi5qZUVo',
    originalFilename: '22-Leonardo_Fornaroli.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOPUGzj87INRundib8da7Do5F5O9RVZ_0a6RSd8b47ZTTHwcPDDr-aG8n-h5KOfI_JAUiZZbtjLkHseQUzupdRW4BUqSDakErvGZSU=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1y3LDEVkws2OYEbjWst3T_O94yi5qZUVo&sz=w800',
  },
  {
    fileId: '1w74vqQGG-ALSicGYzxAGcS6TtJHRfFqs',
    originalFilename: '22-Yuki_Tsunoda.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMOXT5tSPW_WE_U-J2U8r15jyRDN8qMnuJKaFtma7rmGdelJBLmRg4HYM2Junz0orBwFWx6ZUYJWRB4p_-hh8RkrpALKLqC8LqgPPs=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1w74vqQGG-ALSicGYzxAGcS6TtJHRfFqs&sz=w800',
  },
  {
    fileId: '1W8smSKhLHQIMAUGSccwgHB_Y4SQ935tX',
    originalFilename: '22-Zane_Maloney.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOxr-1ZA59CUfOZpKLa6IL7nSBZpD_c-Hs3emVI6JrpOhVnVSzW8LuFvOcOLKbT4pgb4SFKHq3oKTYLn7yS5YLNIgpGByXNX1HQlEs=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1W8smSKhLHQIMAUGSccwgHB_Y4SQ935tX&sz=w800',
  },
  {
    fileId: '1mrOKwk-FKIDTLX9TldRDeb0QHIztJhD1',
    originalFilename: '23-Alex_Albon.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBP5RIqW6mjTCXv_2DZokPXXLB5Oddru25PpSN_dKc0JWzpJUYURw_-uoIk3iv74y3DctaDL6c8Qe4M2QEEHwpNdkQyVv2Rn5_JKKyI=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1mrOKwk-FKIDTLX9TldRDeb0QHIztJhD1&sz=w800',
  },
  {
    fileId: '1mlU_NBxCSBHWjnTK80nW0rTw9Bw1bfGQ',
    originalFilename: '23-Oliver_Rowland.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBN_-GeVj1xPonIt2dFc9ugzTbhEI_a_It1dqVPUTtvPTXEjswKHcDukdNlmk16hJ3DLhiz9Tq3SmXLaO7iLhaq5RGsRtI3Qc6dmSj4=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1mlU_NBxCSBHWjnTK80nW0rTw9Bw1bfGQ&sz=w800',
  },
  {
    fileId: '1-LgHfzm0xX0wfyaHc28F4fDkpXMfFFuv',
    originalFilename: '24-Guanyu_Zhou.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNll5X7sQ1N8DTDPYGGe8-oF1grOsIK3hrGhH1H74oGnnkwwFRP-4Om1oPSfXW7Y1xbmnSGulJ4pH07wWpOXr9zdm6PrcyLJod9jLw=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1-LgHfzm0xX0wfyaHc28F4fDkpXMfFFuv&sz=w800',
  },
  {
    fileId: '1W8iwR_GlaDl9cV0LAEhpsoAb8dcODf1l',
    originalFilename: '24-William_Byron.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPZBuT-P2B8gxB6U3voFBf-bbABSAwJZFupvq-FngR-Dnl7K7bOkZm2Le5e3UQiFzXXTlyIl5Kml9euSUKIFJXycemD7m6jTXG6Xb0=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1W8iwR_GlaDl9cV0LAEhpsoAb8dcODf1l&sz=w800',
  },
  {
    fileId: '1TseZk73iiIjyj29_e91fakoe8GBEz8ki',
    originalFilename: '25-Jean_Eric_Vergne.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPQKekpOcvMlTq_uGixYJhPlzN3NwbCZcuiAViFW5h27yNouHguAPY0VsToTUB9KJeAgYWS3kA7azTNijc68yEVHrRA_2liwn-oJF0=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1TseZk73iiIjyj29_e91fakoe8GBEz8ki&sz=w800',
  },
  {
    fileId: '1KK2i2keC91XiTFBz3_M0J_1y-kLzHD9-',
    originalFilename: '26-Colton_Herta.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNzfnEm8XappbS7keOH1pGyQZm8PwrhOq9ulCYv8bg_oz64lAECVrAgwP6hDlly9eI50ya9U0yzC1j4bA281Kv4_grClkPTdXuyIiA=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1KK2i2keC91XiTFBz3_M0J_1y-kLzHD9-&sz=w800',
  },
  {
    fileId: '1cZC67qXTjbbiPSwpH2CWQKWih8-tVvxE',
    originalFilename: '27-Jake_Dennis.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPFohFrNQtEQlUFM0aA_jneIv3EjD3wV5ZG9lh32KA1T8f2PGiZDsQF1i5WCHFlivFJZDzC7PNbVf5yRec_u2e03kjpcv2wXvtQWJg=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1cZC67qXTjbbiPSwpH2CWQKWih8-tVvxE&sz=w800',
  },
  {
    fileId: '1K61rdzfzqAAslo5z02VlL90jojOoRP9Y',
    originalFilename: '27-Kyle_Kirkwood.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBP9HoMVKPvC_b_ClUtjHxQ5beCq0N_BrFEBf35vYx94EdtqyAYXOM9Vuoi5xT4yT8zucnB5C5sO1gotUYLzQPvyR3JbyT7R91tw_fQ=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1K61rdzfzqAAslo5z02VlL90jojOoRP9Y&sz=w800',
  },
  {
    fileId: '1VwFWNXp1O5a38ev0Ngea4QdYsWamFwim',
    originalFilename: '27-Nuco_Hulkemberg.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOF2FUmLWFl98sdGj5zN_r1Y2LHLqGERCkq0iHPnOOeCbyfxRT_xuMA3izglZ01vscZ9LB08l5ul_71amuTgQQ8bcfOVkHSPNHu1Fk=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1VwFWNXp1O5a38ev0Ngea4QdYsWamFwim&sz=w800',
  },
  {
    fileId: '1E5s3Th4820XOT2zgoBEW_Xrboq57H35W',
    originalFilename: '29-Ayumu_Iwasa.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBObIL5X3Qn-NBNomxBnzJtm51_5H9P-E-xV2EtL7jVLl7C234TL4G-TjQK0JUgc38dpFc98O6ElsNWLYa9X-cZbxY5mHEJWXxoFde4=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1E5s3Th4820XOT2zgoBEW_Xrboq57H35W&sz=w800',
  },
  {
    fileId: '1-Mwe7xeXiwMTdeD_XKJHs3lOjTi2hKQu',
    originalFilename: '30-Arvid_Lindblad.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBO0ddU3W_6oi-XMG53bE8rU7GbOsI369W1dkjz9o_Xq6WrcO690EAQm8ZxHqoVP7yxbC_PmewARd____tnyRt3eBHaCFSE8-qLEMbE=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1-Mwe7xeXiwMTdeD_XKJHs3lOjTi2hKQu&sz=w800',
  },
  {
    fileId: '115mfS04o3P3jAU06VDdsvhoWmaArKJbi',
    originalFilename: '30-Lian_Lawson.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMqbpAvYpBd1ss-EVZHyPBZICYj51IKZKGX7R-sPGeTBZRiSwjzAtWu3IFpNCrUGaJZcXUrFRhVrNkBbO8JqwYk1CtUGlsLup5apLE=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=115mfS04o3P3jAU06VDdsvhoWmaArKJbi&sz=w800',
  },
  {
    fileId: '18W3KkdFvxci9gnm6YMd5_fI9e489AhaM',
    originalFilename: '31-Esteban_Ocon.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMJOOuQ5y90wCY4pB8pusD0uP0diEl1GXn-PJ3f-x_xDuD7AIzwNxWRg9JAUAtWrmlh7V19FNyto0BKACOmYA95K9sOKgQApshmFUA=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=18W3KkdFvxci9gnm6YMd5_fI9e489AhaM&sz=w800',
  },
  {
    fileId: '1RwgvNRUOZqThAM6xAeXg3wUc18MNPELk',
    originalFilename: '9-Scott_Dixon.jpg',
    sourceFolder: '1OAz4K2xl98CpGfe9XJuJMd7bfYpjMWiG',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMtPynM0SwlUQk5yFeVOEMAIMkKmiVPIsHnVmUemIAss_WN3uYgYNp6GliDtOsuNh0ROazH80RM_QXNgwNVTPFFaG-w7yu7eDSEm04=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1RwgvNRUOZqThAM6xAeXg3wUc18MNPELk&sz=w800',
  },

  // --- PASTA C (1VnsvoBZjLzK1G2rNwycroaixLVfITnvE) ---
  {
    fileId: '1ndWysxHRl-k6uLY1SW0fGhxzQ-aOZEsb',
    originalFilename: '31-Pipo_Derani.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPhSFdB4fXWIZvnn1G1z7ozbGJ4XVOML4nh-aJULXVRuZG2VP2rTt79kZsThT3iGCa0I0YqYfZX7MY1vBTBL7LT_4KUI0hDhTT3l34f=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1ndWysxHRl-k6uLY1SW0fGhxzQ-aOZEsb&sz=w800',
  },
  {
    fileId: '1rmm2dGI0fHYKhNFEIvCZe1OZeoXa3PEU',
    originalFilename: '34-Felipe_Drugovich.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNVorxgIq-sT6IRzUSBmz01avQMMBkgHhZgdX9ys4-dDbwSZ0rv3mOwg1D3Nsi4N_QEbt0PvFifN9apF--_V79cVUaRy8bQsbptPH76=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1rmm2dGI0fHYKhNFEIvCZe1OZeoXa3PEU&sz=w800',
  },
  {
    fileId: '1-VX8K2tHkqJZOU3hLQ9xnBoH6TDM0Vqu',
    originalFilename: '37-Nick_Cassidy.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPgQoLwi6x7Mx36zZ4aVoW_-JoLPlWoqWwzuuGwWWkj6E8z4Dn27dM6MNSwYxueQcSALX8estZzUb4i5v7BpyiaRCwARBJCCJHPFkzC=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1-VX8K2tHkqJZOU3hLQ9xnBoH6TDM0Vqu&sz=w800',
  },
  {
    fileId: '17qu-t67c0tjNVY6SnlBREfavknTxEjf5',
    originalFilename: '43-Franco_Colapinto.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBODOeH4EuNA9nx_HMvTt1TExf593gVrep4wfzoyIpUGjyYhPlVJk5e86uXElhy1LdhTzTUqSyqlLUvXTV0aree5MHKe8z8jcrAIU-yl=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=17qu-t67c0tjNVY6SnlBREfavknTxEjf5&sz=w800',
  },
  {
    fileId: '1GL1M2J-QHgVaZJUCbxZRobSoiMngI35Y',
    originalFilename: '44-Lewis_Hamilton.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMnMOYebsjDepmFAvNTyVPL96VoMnEM8jV_VFOphDNa-AIx4K6Ea4RTJruZBJnO-ACM1P1ub3I-h-AFUg8rciQ8RHvDnilZThbLvREh=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1GL1M2J-QHgVaZJUCbxZRobSoiMngI35Y&sz=w800',
  },
  {
    fileId: '1z0L0C4bSeqgZrZeFGbBldlZrVH2pOsjc',
    originalFilename: '45-Tyler_Reddick.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMF96eA2BdFRgQk967krCUTp8sBgvmPDi-f9WnHBDrxBe_rxU3f1QmukmqT0wHQdVnT-31VYyx6K-3Liou2tUPAu3aTYzesZNcG0RAv=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1z0L0C4bSeqgZrZeFGbBldlZrVH2pOsjc&sz=w800',
  },
  {
    fileId: '1PCIZNCvolecPZIKS_jh4cAqPSAd3ClRb',
    originalFilename: '47-Mick_Schumacher.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMe4v83K0ye7VKAP--V17URToPoOlJ39ehdWaxSwo2EHSC2ogHP_p8OKd3i4NIeYhR7RBzbTJI4ir5qvkuyGEXyPdZj-cO3F_CA5ym1=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1PCIZNCvolecPZIKS_jh4cAqPSAd3ClRb&sz=w800',
  },
  {
    fileId: '1EYh3Cqpde47PVLgeCHjeB1ZBHmQle7AB',
    originalFilename: '48-Edoardo_Mortara.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPCEV-fhwq7Hv5wD9XGUUTQzFfA4v9TsXaakeKB5qh0KzDaqkBjkx2hR3AIlglHpj1ajzstHVf_CDD-QWZkUp2xInNjxLN0FqHIRkCd=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1EYh3Cqpde47PVLgeCHjeB1ZBHmQle7AB&sz=w800',
  },
  {
    fileId: '1Rz33sE3Z29z_gVn19HCDCa-1Q6_yEa8s',
    originalFilename: '50-Antonio_Fuoco.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBP90NAdYq-XsLas5p_ci_R_8k6roEC3E-THPfkmHDUQnQ8q_1OyqlKfJniSCchavgiKG5MMS8yBVmJkqbJwR2G0O0A0EBTbCLYxXeda=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1Rz33sE3Z29z_gVn19HCDCa-1Q6_yEa8s&sz=w800',
  },
  {
    fileId: '1au-f0Lf_klNh4nMB8W_t_njcXCu_LAze',
    originalFilename: '51-Alessandro_Pier_Guidi.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBP9i6aOHUFCrGaJ4b5NGX2kbwIkuzm_xs8EjfCKnl1fJUuowHxgtx7tVo54AWxpAXXkfid3V81u6R3x3ZmmreQNVa2aAnZk_wYbrXwr=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1au-f0Lf_klNh4nMB8W_t_njcXCu_LAze&sz=w800',
  },
  {
    fileId: '1Eh8pDB2Ccvu1tgrr0zj3Hz3iq9BS_JtP',
    originalFilename: '51-James_Calado.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMiMeeRzgYuMXEwPab-ZhHClFdqyxZsRblkO-YDotRud8kYGNpw-celkVgKYrMogaDUZsn13PB5Z5wYRENGgI8pCrM2m4A3UxXMkIvb=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1Eh8pDB2Ccvu1tgrr0zj3Hz3iq9BS_JtP&sz=w800',
  },
  {
    fileId: '17-m1V-yaFuz_EdUg8Aq50byVvKzkuLuJ',
    originalFilename: '51-Pietro_Fittipaldi.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOgU1i1SdyF-TwkWwknWiMLOTSvG6Nh7eyQdtoPeLN_RuJ63_vyyzyyfKxhVNn8Qc12e2LC1D3hm3_3-eGmTxDgRaTBT5aOj-15XI4T=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=17-m1V-yaFuz_EdUg8Aq50byVvKzkuLuJ&sz=w800',
  },
  {
    fileId: '1qhgYJ-ex8m5tOWTwAlJSkGjCQLljE8jf',
    originalFilename: '55-Carlos_Sainz.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOZfQAAsPEEjqC1M3VuV0cHbv2asveVzY6aMNV2c9HP1HrgZeTQNa0ZUGOpg0xykAGydYokztAo3IgirF6Ai0YWeLHBFbaku8I6g2dJ=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1qhgYJ-ex8m5tOWTwAlJSkGjCQLljE8jf&sz=w800',
  },
  {
    fileId: '1zllC02_XXZrY7XO71Uz6ZD6x-y8M-4mL',
    originalFilename: '56-Rachel_Robertson.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBM5ycfqqlIwU87gZzezsuP1G3_fD4OUC6yejcFyUJTCh6PVXj-onia9CEJnfUrlZKozNT7AEWiG8rnxjRcVpW-Ih-YHwVmgnuz1xeCQ=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1zllC02_XXZrY7XO71Uz6ZD6x-y8M-4mL&sz=w800',
  },
  {
    fileId: '1OuR4zriz6a3GjwsmuPaQMWShpYkjUNWn',
    originalFilename: '60-Felix_Rosenqvist.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPANrNu-yHAKih6ufvakcV0QaTIecC8MuQqDQc-y0sD7TbxIq1W5H7JK6vxbefCn5U9pGWXe3jShwrgcCth83ZNaBqFjf2SiDrsXGXR=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1OuR4zriz6a3GjwsmuPaQMWShpYkjUNWn&sz=w800',
  },
  {
    fileId: '1BIGj-F9MYBIwNvjeW-N243EG865yczJw',
    originalFilename: '63-George_Russel.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBM9mSCGX7tHbpCgHVdAh-x4dX4rIOoRTe0vpTIantk79deUdcnOZAl8PE70OhBstY7NDKgNt64Tc8NTyczZJY7fpbMU2wV7DA57b2QS=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1BIGj-F9MYBIwNvjeW-N243EG865yczJw&sz=w800',
  },
  {
    fileId: '1CFAw6-glx_LwleUDhpeHKWFjESuKkofu',
    originalFilename: '75-Brendon_Hartley.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBN8CbA5JQLSJhisOm8fssnLEo9Qf6qJfm5g7SnblosMJC6163Z29Rjo9eWKkdRvzOG4Ntcpi-jOee040pM4Y0C-TdoNSWM1QQNbwu_K=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1CFAw6-glx_LwleUDhpeHKWFjESuKkofu&sz=w800',
  },
  {
    fileId: '1Z-xc9Os3QhCwo5EaclL6Yzjqy-O6pUM_',
    originalFilename: '77-Walteri_Botas.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNUnAwB9_oSy0N2gay1RfSrwGuMezN2cQSVjJ8MZ_OwteCXLGgYaBGHII9k2Wh90GW9Eago3ER0eVPsKWG61f2kt5XVo-u53SlNm-Zx=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1Z-xc9Os3QhCwo5EaclL6Yzjqy-O6pUM_&sz=w800',
  },
  {
    fileId: '1zRrbULfB5c5EPEPuWv7iH13fxIQx7JYa',
    originalFilename: '81-Oscar_Piastri.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBN20WqRpo5xE9bxIdnOS6WbK7H1Cl5qST-oPbE25a8OgYI7A-eIYXX02cYAokguVtB3qyukOcEUm5i0SIHTt6YdMrjQ5kOoikCNIMBN=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1zRrbULfB5c5EPEPuWv7iH13fxIQx7JYa&sz=w800',
  },
  {
    fileId: '1OqWLcWmyas0cS34DnJ-mQbYXNn47rYT0',
    originalFilename: '87-Olivier_Bearman.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPLu8V_CXjZjxKANDSnqqpD0djRvhlhFyRJ3O_Cl9LsI9hq2C-LmEDzpVHvPa_Shfp2OVQRVCkuUuRp0tvejugSKadCJLzcoWNMWvZf=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1OqWLcWmyas0cS34DnJ-mQbYXNn47rYT0&sz=w800',
  },
  {
    fileId: '1YQIS2MIcH_2HMjvylgT951hONNHDXC8e',
    originalFilename: '88-Robert_Kubica.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPN8mC6cn6rpD5iBT7TWV_PYs6C7YX1VmLExDKfFk96DNzid69oFQG0qnBmsvYpl-x-bErGMgAwEu9Z7n4JPfArR5l4aWKw9vCWYx9P=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1YQIS2MIcH_2HMjvylgT951hONNHDXC8e&sz=w800',
  },
  {
    fileId: '1WiwGiyjOpK7kVtES1-S42vtSox4gvRKY',
    originalFilename: '91-Kaylee_Countryman.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOrVHhS4ccnvW8MRWpNR4vbvHhLpfSzMgcVLajpaADxhmW4ArsFHn02ZJC4SlHuuK1HII0uXmjzw-L3skQqxylX7-ODqUzbbtGqrqCg=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1WiwGiyjOpK7kVtES1-S42vtSox4gvRKY&sz=w800',
  },
  {
    fileId: '1nTthS1hxB2xIrjLSYkh6-j7tgx7C7Lv8',
    originalFilename: '92-Kévin_Estre.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPYAY9yCbH3d_hgn0YJ0KPAxOGFWpXQbjxef1Q-zG58mrDL4ZzyJOH4ZqHg47cAkn7owOO2NT1ttRfHFsPlbZbZ3Sf_lFrrkDyzV3sp=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1nTthS1hxB2xIrjLSYkh6-j7tgx7C7Lv8&sz=w800',
  },
  {
    fileId: '11373lYwWNiGSkvrugnCIqlJLv3LnEeab',
    originalFilename: '94-Pascal_Wehrlein.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNoREmDeJ-QMX_UMvO38amij1D4-4yikNNqXNGvNRXbhHUFSwpkI0pA3YTcu7n9utez90gVD4DilhcS8QGcpPm3ncsFWoSuz64CdU7j=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=11373lYwWNiGSkvrugnCIqlJLv3LnEeab&sz=w800',
  },
  {
    fileId: '1LwaP4eJxvAs31fKJYeSaziY89WNmumif',
    originalFilename: '95-Jade_Jacquet.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOdGB3Hpv7GJa9VvDbs8I6YWWQH8MSyEZ-g2fCmzQU7bCOnGup-kjZ9Xq_8Oxma0mQy2kggX-FEIh2cfXWoTlzRS6rPKInMYEEmqgWY=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1LwaP4eJxvAs31fKJYeSaziY89WNmumif&sz=w800',
  },
  {
    fileId: '1t2zfDq9XsTbUwJPXGDB56JUkUTIWIZdT',
    originalFilename: '99-Antonio_Giovinazzi.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPlhNrI-AcolcW54g_KyHu6dSZGCZ2H9WbrpUyN34SzB1rIC1-3xTjHld8d87XEYotNIxlqAJfgzDKjPdkk0qy1UeSub0RHhxjzRVKo=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1t2zfDq9XsTbUwJPXGDB56JUkUTIWIZdT&sz=w800',
  },
  {
    fileId: '1SjCOXWTw4NANQj58kG7lhIz8G9zjZGUR',
    originalFilename: 'Alisha_Palmowski.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMBu_E41fEqKEm-bQdnzRVnAhyx4E1C-57JDVbToMiIrbK93kUpSzm4M5SflBsup8qwqfrK_0ieH4FsFzpSDRqWHNmaY37Pl1JpNnJu=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1SjCOXWTw4NANQj58kG7lhIz8G9zjZGUR&sz=w800',
  },
  {
    fileId: '1qguZWhRaytJH6mGJ_7RgVMcyCDx7oJtY',
    originalFilename: 'Amaury_Cordeel.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBO9loRpw_GHR4yfUJgFLQjB8mqDZ_djq_vYKVYvADbaIV7HLRGA4BCNHcxdsZE0jhPVAL_6oS_Ok865YYonzHutLvVKOBuQukQp-ij6=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1qguZWhRaytJH6mGJ_7RgVMcyCDx7oJtY&sz=w800',
  },
  {
    fileId: '1Od515TBI1ZjrbOLAHnQZ_7Z83FvrbkVS',
    originalFilename: 'Antonio_Fuoco.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNmipqIvd4tDX-Mt92o90XAK85KVCHcealbNWz5pQ5AJE7t5QOhJUANRTSJCFDw46dgdTAxAWKfq6LIRo3ddVs2RMtrzRieB-NdQwnJ=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1Od515TBI1ZjrbOLAHnQZ_7Z83FvrbkVS&sz=w800',
  },
  {
    fileId: '1PXm-B7QO7jVYzyiikA9OfNadXu4RBf-0',
    originalFilename: 'Ava_Dobson.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPOaVVh13eBgsFgjoTEUpiyQhANesEvQvav6lwufzttwP3gCzBXyS3y8J2m4XjcePs0M-65LyAITIEuTb6CXINn4WXfqVMnBXtXbyq6=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1PXm-B7QO7jVYzyiikA9OfNadXu4RBf-0&sz=w800',
  },
  {
    fileId: '1Wy8mn_QawdLrUwDFUDanSE6QQkzy01nG',
    originalFilename: 'Callum_Hedge.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMvqVuutJiC5ms89l4kNoQ32xGy-WOnhmajAjFblCacAZtb44yXMoez4uvbIfFsyCb_Ao5JWCoNbr6q5tc1TwbbxKdQeb5bt4E418rD=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1Wy8mn_QawdLrUwDFUDanSE6QQkzy01nG&sz=w800',
  },
  {
    fileId: '1oiXiypIVaW727G9aq7IQAVAUmtu9q5zd',
    originalFilename: 'Chase_Elliot.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNo0-blU-NJ4TVDuzIlZPGsQw8VK5tIrf534Smh_A7O0ybpHW5yxov5dDwcp-Wj6wpip9XljdG-asfP9UEj-tIBBJvuaXGOreJ4Z7nO=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1oiXiypIVaW727G9aq7IQAVAUmtu9q5zd&sz=w800',
  },
  {
    fileId: '1dzm9SkI6oImqJnxw1bF-88iWsFU_9kbI',
    originalFilename: 'Denny_Hamlin.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNyC96ktWN3MdJcoCaYPeWQTmQ2nE5cRstUqQgp9GLktpRQv9ILUjfvYt4vC3QIm0-DqmjVkwsEux8NqbGeflnfZmN7x1W3D7DedSKg=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1dzm9SkI6oImqJnxw1bF-88iWsFU_9kbI&sz=w800',
  },
  {
    fileId: '1P3pqiSQaBXkrXpYqdJyPL5OLSuduz-0Z',
    originalFilename: 'Ella_Lloyd.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNRyRVFchy-UckOmX5zgi332rbo3-3-kpfmDGLX2zE8qoGyoqnPdKQdquMU7aHFtHeDcV_F_dfiNYuRz41wn2hZ0MIDYvF5vU6m-iXP=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1P3pqiSQaBXkrXpYqdJyPL5OLSuduz-0Z&sz=w800',
  },
  {
    fileId: '17mhC_BMlwFxNdV8HW_c6eMuElHQq5Bjb',
    originalFilename: 'Esmee_Kosterman.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMNb5lEzHSm_OIiJlLVKxaYaiDxZ9bDZSSgIkiEt0g7X9BReMbVBgaQxVzO6ygRSO9WCT1srhBhe6Sj7ZgKvKfHsFEJyTJEkRS7Yb6s=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=17mhC_BMlwFxNdV8HW_c6eMuElHQq5Bjb&sz=w800',
  },
  {
    fileId: '1KI4El3N48lMbdLRJV_P7cMuiltXeI0ud',
    originalFilename: 'Jak_Crawford.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMK-FPePfgg3vLUBsUV8ppFVLOvBqaPHxYc_etaeunLlWN1s6Y75lZ2W79Rb1zXZppN_MJ88hlH7R13kdrq5BKF7nw3zc5B_OY5lzTW=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1KI4El3N48lMbdLRJV_P7cMuiltXeI0ud&sz=w800',
  },
  {
    fileId: '1A7JjOaUye7ElrDV-bjbCIv06J3pWGuuH',
    originalFilename: 'Jake_Dennis.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPrBw4pRNhlut0M5TdTGOuRSm8G89gFh0o00oQYyngX_rXT8GzLZf141d9uj2FXmK85pN-XkgDzbeq144yLh7LSyANJTnnEJ9uIKU-H=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1A7JjOaUye7ElrDV-bjbCIv06J3pWGuuH&sz=w800',
  },
  {
    fileId: '1D0fKpA3Y78lL9JzAoxE6WkJt_uh13Jms',
    originalFilename: 'Joey_Logano.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMOq8PqrPZFlxjB5yDPzdxULR3ijKhTGF3vpS0eOG5dTWiIdtsenKwgRgCj2N-P7lj1QPoM2SFehUAMDkiNRy1VsdStToDMta8t7De6=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1D0fKpA3Y78lL9JzAoxE6WkJt_uh13Jms&sz=w800',
  },
  {
    fileId: '1fnr0udDl6byApPIVUuQ7J6-YcTE-eb7X',
    originalFilename: 'Jonathan_Browne.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBN_tDPZ5Evp2Cr2oufm6FG0WOX-QAn_6jwle9NFDX46af1Rcns_HigociNQRpVgfmwqdO3Iss5Go4EB1Hpx-Dmk0qEAhxsNX3l-v32Q=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1fnr0udDl6byApPIVUuQ7J6-YcTE-eb7X&sz=w800',
  },
  {
    fileId: '1YQ2mrHtIYhSzt2Oi01SNVAkGqNsL0x-d',
    originalFilename: 'Josep_Maria_Marti.jpg',
    sourceFolder: '1VnsvoBZjLzK1G2rNwycroaixLVfITnvE',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPYSR5O5hxQRt2DNbHk3GY33rSDrRALqcElU99a4a0PNFaH6DDjn43z7EEBEEv9NVRd3z-RDMhjUQ5hlhMgFf6VSNb5L5yCbaxGM5wa=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1YQ2mrHtIYhSzt2Oi01SNVAkGqNsL0x-d&sz=w800',
  },

  // --- PASTA D (1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m) ---
  {
    fileId: '1rC5VyPTnytr4KLh0DyVLVKM6zYJYU5wI',
    originalFilename: 'Joshua_Durksen.jpg',
    sourceFolder: '1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMRPsGh2IbDgRqzDsnwx5UBu5w6Zqh_Go9ca1R8czRRUPGP13ImbaUq-vQXPKNFS4Fo4vedmZg6_cElw9ozaHHODRfbxG82ARrSZflu=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1rC5VyPTnytr4KLh0DyVLVKM6zYJYU5wI&sz=w800',
  },
  {
    fileId: '1DtTfBqRXBH3AB9m4YUDkdAK9C2d5DRLn',
    originalFilename: 'Kamui_Kobaiashi.jpg',
    sourceFolder: '1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPR4n0qXOMls2y54Z8IrWD8q7B-eO2VTGj4-7C7-NZgIkyBLHpqkF3925JIIJ6zW0MlACZDM3xOcVbbLanx8ewdWGL43NYHEHVO4mRy=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1DtTfBqRXBH3AB9m4YUDkdAK9C2d5DRLn&sz=w800',
  },
  {
    fileId: '1G-pS2wCyGB7nYG1p5en_291MpAvYGWAZ',
    originalFilename: 'Kush_Maini.jpg',
    sourceFolder: '1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMJN-suF5f2XaRkRM4cvY_-j19MANvOXxXQm9eTRhWUIvOQut-YK8_ktWKnJytjVmdXadvHtXMLH0DVeZX9k5Dd1rVG5c0eWd3r1F52=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1G-pS2wCyGB7nYG1p5en_291MpAvYGWAZ&sz=w800',
  },
  {
    fileId: '1cXxCqnZZ2aPwNsEr5SzSoXd5WLh8qf1L',
    originalFilename: 'Louis_Foster.jpg',
    sourceFolder: '1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMD8RR-Wh8PSTeH22cW2ctgqYcqhm4XuSMDl9711UEi5YTNWRsSNld81tcNGHNNKnUtbhpovOEdOlul7g_FwqtKGTi_YSnj2hhNFD2i=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1cXxCqnZZ2aPwNsEr5SzSoXd5WLh8qf1L&sz=w800',
  },
  {
    fileId: '1LwtSoQyyAFV2uE1GILFrygaDld4z-yNV',
    originalFilename: 'Luke_Browning.jpg',
    sourceFolder: '1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNFx9C9SGm1HvC4osxfCK3X3Sm07ulBRZpzuOV1Pf_N6H0wWmOBIH5uqS8V7c-bDnvg3EcemTymeTwyIcFC4Rd41mauiTAZ7OKRx1Nu=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1LwtSoQyyAFV2uE1GILFrygaDld4z-yNV&sz=w800',
  },
  {
    fileId: '1zIm_KHlEPj87eq0xXXYu4yrGqDIAraoq',
    originalFilename: 'Mari_Boya.jpg',
    sourceFolder: '1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOxD-fKqnph8vXM8PgmaID5J1MDAKZW5fdzuX8ilig-R8rA5HFsooBAMwVTB8JwnDOatxj3VhSEcnwXVfy4aqrhKZi0QIsatekdK374=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1zIm_KHlEPj87eq0xXXYu4yrGqDIAraoq&sz=w800',
  },
  {
    fileId: '1c9SK0dfv3iKrkzh5UDpxU-hkvoalGLkn',
    originalFilename: 'Martinius_Stenshorne.jpg',
    sourceFolder: '1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNdD62oeWfTVVgYqFvoqk6Z7GCEIhEbPZM9gL1n7zhf2zdtTNM7DfCe7LUgXu4iJM4qgRHxpBeGgMK9L7xguQ2MwiHPk-9m3WuKPRk3=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1c9SK0dfv3iKrkzh5UDpxU-hkvoalGLkn&sz=w800',
  },
  {
    fileId: '1N6dC3_PlomQ_D40w9zVQ5fuMhXCLRm6a',
    originalFilename: 'Myles_Rowe.jpg',
    sourceFolder: '1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOLEIjDeilywhE-qj3kTJwGU-_qyUHJnS6EZinXdOJQAJkjMBUTRGnELkl47NmM3ba1R6Z1hpW5CS8biLkN0yIN9zw_5LlfXe2hMvEd=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1N6dC3_PlomQ_D40w9zVQ5fuMhXCLRm6a&sz=w800',
  },
  {
    fileId: '1v3sFL9ElK8O9Uuud3gT4vBF9UDF0grga',
    originalFilename: 'Natalia_Granada.jpg',
    sourceFolder: '1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPUgmSsQPNZaiVh9Lhd41cGP9H4G4Bhb2oZoNgrj-KrGk460dH5guYPtrENOMT8gG2JhjxEX66-nucAGXtqalmhLboigY1WvZ1LsViT=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1v3sFL9ElK8O9Uuud3gT4vBF9UDF0grga&sz=w800',
  },
  {
    fileId: '1JDL5GLQYNR997AKuXswkQkIRigJp8SYI',
    originalFilename: 'Nick_Cassidy.jpg',
    sourceFolder: '1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMJGjnukSEVLMqL_5IT40qULfi0_c5wHY-mxhq3NWfXWipSp_312OZBWqn8xalWlxQG8F7piSSXhTlFi0HfiNGk4Yui4yLwY_qg2lOG=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1JDL5GLQYNR997AKuXswkQkIRigJp8SYI&sz=w800',
  },
  {
    fileId: '1gk1z3oHWWX-LPR8K-yvg3_gxLppDkjsT',
    originalFilename: 'Noel_Leon.jpg',
    sourceFolder: '1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMGvBIjHe42jbif8c32_zBIhGgC7G6ILXydK3lLp-V7qxD29abWB1JkFLLBKsFL0F5m2ZXHgDmdEPc1XxtUCeujkCA8b9VP8zYV_oVm=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1gk1z3oHWWX-LPR8K-yvg3_gxLppDkjsT&sz=w800',
  },
  {
    fileId: '1iSFE4OOrp248_5Mi8XLPze2j6Bd5lSqx',
    originalFilename: 'Nolan_Allaer.jpg',
    sourceFolder: '1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBM6sP0QCCfE63FyQ4C8UXeosGIJUTNr0vEk9oNp8LHv15HvPefPjefUOZ-uupw5FL6gJcc-NbDoekZ0eewmmv-E3e9-p2tOj-DOmPtV=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1iSFE4OOrp248_5Mi8XLPze2j6Bd5lSqx&sz=w800',
  },
  {
    fileId: '1tuOSUSreTkaT7-dOWYA6d_vTBugCi_B2',
    originalFilename: 'Oliver_Goethe.jpg',
    sourceFolder: '1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMCuRqp2lsYG6mt8sMCPPVIXciS9dcG7mPbCZWnJR1MLnt_yHJ6d_YmVpg5P_6334ScKMKz9SE0-hbgbdoDpzX_gxOxTpLvkJ2AQL3f=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1tuOSUSreTkaT7-dOWYA6d_vTBugCi_B2&sz=w800',
  },
  {
    fileId: '1RYvs-30Z5v_hdWGCCEruKWDVbMaOlAn9',
    originalFilename: 'Rafael_Villagomez.jpg',
    sourceFolder: '1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBPXc0vZfFgMqpTnQ90H_MFK8wPOy8qUqxsw9oZ-ajrrXLjnUJo2ONhDE36QSepdAISdsLbs7CDojen0CwSCp0pTn1a5cuGDnZWUvu5C=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1RYvs-30Z5v_hdWGCCEruKWDVbMaOlAn9&sz=w800',
  },
  {
    fileId: '1iWYtTLr4oo2unIL-t1oVcgGtPIV2saON',
    originalFilename: 'Richard_Verschoor.jpg',
    sourceFolder: '1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNGYM28svmigAxs1q-2cu5Xsd3qqJX5ZjudhdbGjsIyeWI8M0kV_NeXGHlh0IhT9gGeDAWkRuBu-oOAB8RZ-8NdpUuZ7bt3JaErarsV=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1iWYtTLr4oo2unIL-t1oVcgGtPIV2saON&sz=w800',
  },
  {
    fileId: '1Cm6aTBXCcfGSkgQWDcLRGqU8pV7-46ZV',
    originalFilename: 'Ritomo_Miyata.jpg',
    sourceFolder: '1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNINXJWjziGGmKGexctlRRPUzGpF3ysrvY3yjfeh-JwJDDQkp5eQmGDC26CSIQ86D2OQuZjaTQpwzLdCqAxcpRgRAcfaGPHcTWawMtU=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1Cm6aTBXCcfGSkgQWDcLRGqU8pV7-46ZV&sz=w800',
  },
  {
    fileId: '18_2SIbjuGYAbZQqypx-axVUmcwm60T2g',
    originalFilename: 'Roman_Bilinski.jpg',
    sourceFolder: '1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOtfMNcPz3ipTv9yT-Ltlup2NMwCSxbZlB8JJ15fuTOplxj6vH9UIJ9m4POjBY-eXwKHRrAzhWxQJqm2LXT-8xVmE1t-oX8aAxMI6ll=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=18_2SIbjuGYAbZQqypx-axVUmcwm60T2g&sz=w800',
  },
  {
    fileId: '1Tzd67lQQpAwrYZs3zV6H-Sp6Ifp3p2U7',
    originalFilename: 'Roman_Stanek.jpg',
    sourceFolder: '1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBP_R4RW1LHnc7Rm60ikN6U0T-OWaTrtm5KbENIRm9XrMr9WlZEyocvXJqdP8fGJTee4iYFCVtZ253Gcm9FsfSJcEzcqqLiB25LlP6fl=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1Tzd67lQQpAwrYZs3zV6H-Sp6Ifp3p2U7&sz=w800',
  },
  {
    fileId: '1un-jdj48vW0k45ZXvSJ3GSsXR_ULcIXt',
    originalFilename: 'Ross_Chastain.jpg',
    sourceFolder: '1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNxfHD9AufXVahtpyq4RknU3gqL83XEm0Cmz2G-rde586cmyO2_vKN1WwY0hIb7Hv9DbEDVfwyfnDjNmlu3EvVM_A4voPqAWJJUhRGq=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1un-jdj48vW0k45ZXvSJ3GSsXR_ULcIXt&sz=w800',
  },
  {
    fileId: '1yXto-mFyKhExIIwufNP1I1xyDJunl9Zb',
    originalFilename: 'Salvador_de_Alba.jpg',
    sourceFolder: '1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNjUHX5TXt9l17rBxkV686sW-eTBB42ImCyZrRHS5QnhyCmgiXbtOSU4vV9-mx-KNWZ4SHpRYu-NGueiR2oelTxDPRWnV9WnDNy41vR=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1yXto-mFyKhExIIwufNP1I1xyDJunl9Zb&sz=w800',
  },
  {
    fileId: '1rQBjRYRMevU7fiYHKcZIk5v6IE6nnrP-',
    originalFilename: 'Sami_Meguetounif.jpg',
    sourceFolder: '1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOX1mtGBxCE34LgVEdU_y_f82RpGLJwlqzIf8kBjoIuUrJNZvzXlNYwu0l3P0seZ5T9wchd8Yndsp0Mn5vYwyh3-tVmrjGXcs27WDWX=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1rQBjRYRMevU7fiYHKcZIk5v6IE6nnrP-&sz=w800',
  },
  {
    fileId: '1TPo71XqbeZ_reujRb6352DbvGhNa0hmn',
    originalFilename: 'Scott_Dixon.jpg',
    sourceFolder: '1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBM4UusIzsZFmHX8uXYWAAJBdpwqMKRGIj9LMFaRasCVseXJGWlZiPjOecRDJjyuIU9dmYREq63YWUEbdZ8_8O_DxGSu30TeFfJRhPi1=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1TPo71XqbeZ_reujRb6352DbvGhNa0hmn&sz=w800',
  },
  {
    fileId: '1YdqxJGEbyNjW5c91N1mSuaqWwDBzQXRt',
    originalFilename: 'Sebastian_Montoya.jpg',
    sourceFolder: '1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBOPNzHZ767tDueLv5uHAKbq67gC_yac0RYrNRuYGFcYYvC0M10bk7T-PkFJoUEyAK-v6IHet8L6feDSxiX1S_P847u_BWH5vaNoPacu=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1YdqxJGEbyNjW5c91N1mSuaqWwDBzQXRt&sz=w800',
  },
  {
    fileId: '1A9QQKQWDE7TIDYXr0PFhl_Yutv7qiqBC',
    originalFilename: 'Tyler_Reddick.jpg',
    sourceFolder: '1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBMMLjwSxJ8adn7p44dvS7Ets_Yatt-IBgJGLH7zZL9w4qwtbkYOyz1hsp35B4hKkBtoLfAnska18N2hEUfxRdOBvezROCwovaeCm2Cr=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1A9QQKQWDE7TIDYXr0PFhl_Yutv7qiqBC&sz=w800',
  },
  {
    fileId: '1ZhzQyKeG7YjPtZ9AU5eCGmDzfnjBOonI',
    originalFilename: 'William_Byron.jpg',
    sourceFolder: '1lmJ3lmx3AC8HbBZjo3wPgnP6okMAa15m',
    category: 'pilot_registered',
    displayUrl:
      'https://lh3.googleusercontent.com/drive-storage/AJQWtBNJfO62j0XDLkiYmM77s2wQehjegjnnvpPfHkJk6adb3F4aCMClyCFWjM90iuEzNjJDDs7hLboFafcbMYA7CdwA6E38NBNI6WBxjrjw=s0',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1ZhzQyKeG7YjPtZ9AU5eCGmDzfnjBOonI&sz=w800',
  },
]

/**
 * Cache de vínculos resolvidos para consulta ultra rápida sem recalcular
 */
const RESOLVED_LINKS_MAP: Map<string, string> = new Map()

/**
 * Registra manualmente ou pelo resolvedor o vínculo entre nome de piloto/ID e URL de foto
 */
export function registerDriverPortraitLink(driverKey: string, url: string): void {
  const norm = normalizeCleanName(driverKey)
  if (norm) {
    RESOLVED_LINKS_MAP.set(norm, url)
  }
}

/**
 * Resolve a melhor URL de imagem do Drive para um piloto com tolerância a erros
 */
export function resolveDriverDrivePhoto(
  driverName: string,
  driverId?: string,
  candidatesList?: MatchCandidate[],
): string | null {
  if (!driverName && !driverId) return null

  // 1. Verificar cache persistido
  const norm = normalizeCleanName(driverName)
  if (norm && RESOLVED_LINKS_MAP.has(norm)) {
    return RESOLVED_LINKS_MAP.get(norm)!
  }
  if (driverId && RESOLVED_LINKS_MAP.has(driverId)) {
    return RESOLVED_LINKS_MAP.get(driverId)!
  }

  // 2. Busca direta no manifesto existente DRIVE_STORAGE_PHOTOS
  const directLegacy = getDriveStoragePhotoUrl(driverName)
  if (directLegacy) {
    registerDriverPortraitLink(driverName, directLegacy)
    return directLegacy
  }

  // 3. Busca nas entradas registradas do Drive por casamento de arquivo
  const portraitMatch = matchDriverToPortraits(driverName, DRIVE_REGISTERED_PORTRAITS)
  if (portraitMatch) {
    registerDriverPortraitLink(driverName, portraitMatch.displayUrl)
    return portraitMatch.displayUrl
  }

  return null
}

/**
 * Casa um nome de piloto contra a lista de arquivos de retrato
 */
function matchDriverToPortraits(
  driverName: string,
  portraits: DriverPortraitEntry[],
): DriverPortraitEntry | null {
  const normDriver = normalizeCleanName(driverName)
  if (!normDriver) return null

  // A. Exato pós-normalização
  for (const p of portraits) {
    const normP = normalizeCleanName(p.originalFilename)
    if (normP === normDriver) {
      return p
    }
  }

  // B. Casamento com entity-matcher
  const candidates: MatchCandidate[] = portraits.map((p) => ({
    id: p.fileId,
    name: p.originalFilename.replace(/\.(jpg|jpeg|png|webp)$/i, ''),
    type: 'driver',
  }))

  const res = matchEntity(driverName, candidates, { minScoreThreshold: 0.72 })
  if (res.matched && res.entityId) {
    return portraits.find((p) => p.fileId === res.entityId) || null
  }

  return null
}
