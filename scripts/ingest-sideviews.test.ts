import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// Lista extraída com precisão cirúrgica de https://drive.google.com/embeddedfolderview?id=1fyThTdC6asFV6zNijkXuZbtrgbHcr-BL#list
const SIDEVIEW_FILES = [
  {
    filename: 'Alfa_Romeo_VL.jpg',
    lh3Id:
      'AJQWtBMSvdu_66p-Uhv8hRAg09qUKax_rrPl0YCSALQ4SUSa8NAp0gJwM9aL5k9NlXjuF0r2r8J3v93PYH3TlGObPoapkl4k7AGmgeuCWwj1',
    driveFileId: '16oMjndfj5xYaCjmJJQH9Qr4wi08UJCgM',
  },
  {
    filename: 'Alfa_Tauri_VL.jpg',
    lh3Id:
      'AJQWtBNy2G0PvCDX419zsoMVcs8YLIuryhM7YLj8ltv4m6c_9I0NqpB6-3t7HyUIqp2qrraexbwwoMCiIPDMtTyi_GL8fLqXq17u_dtNmR6q',
    driveFileId: '125mz7XOmVvyUuMJdErJkoOaUALp4i9nU',
  },
  {
    filename: 'Alpine_VL.jpg',
    lh3Id:
      'AJQWtBMya68sZVU5jHVkCP3nO97qE9FnUQHNeZWKDrvuZ9ryXwrUUc3am3mJuaeDE4CxO5DmlhrhkD_XSlkjyCrVFyrI5g31-Op3osIEojHV',
    driveFileId: '1FSa8Spjz5P75jWqw5nUHgv8f5lInWniC',
  },
  {
    filename: 'Andretti_VL.jpg',
    lh3Id:
      'AJQWtBPh6U1fCGOI1NfHxp7OO12hvlCKcCVllRDt6OGDvTEJAkiUIzPjoJZQjNyAK5E_NVpk6TEjWDVlF0BL6IymSMMZfk9MCTbA97h5LMDC',
    driveFileId: '1NCfrPxFDzrDnx8Wr_O_z9JEdvVbtGews',
  },
  {
    filename: 'Aston_Martin_VL.jpg',
    lh3Id:
      'AJQWtBN303VY-i1YwqHFWJcpND_D3Pc8HTUl9e6N8UpJjCOND5V9PJZ9-_RFt-6-KcuNlg0l38ALLOHdCHo5M2vKHOucTMoQTdLx8H_m7Uxz',
    driveFileId: '1_RSg5PIMU288W7suUDP3dBE_GPVm_d3F',
  },
  {
    filename: 'Audi_VL.jpg',
    lh3Id:
      'AJQWtBPllDwzPOQrkIkT6o7AJ3haZzVveA6ZkMRqAeckJre_F64KpYX8ddcEAT2scXEVFONaht4IwjlR2MpksyNoyQ8sqTaeFMLVdhMWZ4-q',
    driveFileId: '1zbTdTGLcsalAd-BxiatuO9k6ZOrRpY6e',
  },
  {
    filename: 'Benetton_VL.jpg',
    lh3Id:
      'AJQWtBMBxVtNK5cj4GcHCguWjms171TNyjpOfnupqWRiUVDPfLZlKpwRRIiHQbrjSXwUMVF9-IvgEY5lGe1jUnCTNGspj0RR-EY_bBba-uuu',
    driveFileId: '1eauXLCV65FbUTGVidlTTNnZ4PfL8o_1z',
  },
  {
    filename: 'BYD_VL.jpg',
    lh3Id:
      'AJQWtBM-zrPATyEkwrez704IFEBvk_NZwppZhsoKrdkSIMBC_5C3LSOPS6Y6vQbO-5eWLNFaPmXKTc9JPZtTl5F36PX3RdaODDnGu0BjQ_Xd',
    driveFileId: '1NL_qSVEDRY4cae0G-Ir79iBfinTALHT1',
  },
  {
    filename: 'Cadilac_VL.jpg',
    lh3Id:
      'AJQWtBOaS4zq0uKuTauwmIM8VFKXTJ4Idw1-jP4Hmuy68zTOA16U8r7O2QjgXVfiC4yeY0kdhI-PeRCuFUi_4jlPV27E6D0UkjrHINtyGH7v',
    driveFileId: '1Hizua7n31YV4rQBxHbJ-BePWKVSVTjI_',
  },
  {
    filename: 'Carro lateral.jpeg',
    lh3Id:
      'AJQWtBNZ1BYvdPqQ0s6Thh2EMkfB2X6s6zkVRsuOPFvXaU7qfwAyTHmWNuEUaZeMwljTgMDPjUqhAQH55yonX2P-AEFXlNGZNskBeQTNwaN7',
    driveFileId: '1QkfWAEdVU2u2_S2nnU6ImumGCrehxZZx',
  },
  {
    filename: 'Copersucar_VL.jpg',
    lh3Id:
      'AJQWtBMzhqcHMe_3CXSzFKdmlIKJ6DWeY6_Ks_aKe31UYrLjdgePbSw_lqXYeJzCzXTkc3-9yvrEX-BvFOB6kKrMZNba1ufTX_ZbOikNmAqw',
    driveFileId: '1Wo1Aic7uK-fi5hLooLYLt2PP_taR659K',
  },
  {
    filename: 'Ferrari_VL.jpg',
    lh3Id:
      'AJQWtBNn_adC0X59pvxUwqwEyjqnrx58f9KAGqQxxPcMsORNFcWfAtkQ2EtOZcEsqIIKrwcWyK4_ytRC4kMdZYNYy2T-rdOu6wzx8c2pIC5a',
    driveFileId: '1KtaTpp9X7JeA1Rn0TLdmMVFoGIkMzqZt',
  },
  {
    filename: 'Fittipaldi_VL.jpg',
    lh3Id:
      'AJQWtBP-IVE97IOXOIj3Z1C-vWjFAhcZqa23fvLAXdxU0Icy-F6uiOQs7JgVjh3nKqA_BXdh13gQcQgBbs-BZiAfKw-PqVpDtNfDa2-lHHMI',
    driveFileId: '1m2nT_9JgTCTXIzAbFLj52eglVrbz9nqr',
  },
  {
    filename: 'Haas_VL.jpg',
    lh3Id:
      'AJQWtBOgayoBj-2lnm2Vxi3t_8CjkxXflloQFQLB7jkt7RyFGaLWVLqVC4HfQ_z9LkoQf-z3tSfPoy7u1LU0jAe7-d4aYLbIbkd7NBSlRJ-8',
    driveFileId: '1wSk-ZxBbfNcMneQOg7KwSieBRx7KeDtF',
  },
  {
    filename: 'Honda_VL.jpg',
    lh3Id:
      'AJQWtBNJM2oav6odA59GUPoZ-KE6Vyh9Ic5h4yD8AbR3NFD1O7dvDO1QJUOTrkX1_OTpEwFkrjU9XrTv9nje3JEP_A8NfKrUahvbZ46qq72E',
    driveFileId: '18MB7C4CMM6sS-Y7oOH26YNDME1ScIDrx',
  },
  {
    filename: 'Jordan_VL.jpg',
    lh3Id:
      'AJQWtBNQmC9b3QriyjqQnszQ56q23p-20wRq35yyYeSmo8RfNmLzK05Eo45KxdbqA2-ywLwrwpdLbGr_6xagVNIveo5yMyNxoRja5dST-2oW',
    driveFileId: '1gvrlBXOKn_PV11ryivz25-isJp-ohkVR',
  },
  {
    filename: 'Lamborguini_VL.jpg',
    lh3Id:
      'AJQWtBMHpFey4D2kq90WNvNr3uYWikmaNDksnhfhBYg1RfptgXdceuM6ZCMJTY05XAn8l3SUdnHz07aML9Zs3IaerW_J8F4sNBqkVR9vjXyp',
    driveFileId: '1YDt5gi4Z2GiD0D8ZBgglaL2DcvYo5DlH',
  },
  {
    filename: 'Lotus_VL.jpg',
    lh3Id:
      'AJQWtBMF5DQDn89BBFmeuEF8rKhrfJJMd8aOE0KZmhiiJ5wvOGJYGAWEfp12X4rhTlNlQDwTLmsgoDum_IesZTt3hlzI4olbYnWkGlsLPoI4',
    driveFileId: '1jNphsr5CS-h7O6CZgqHbExGBWzniMa1i',
  },
  {
    filename: 'MCLaren_VL.jpg',
    lh3Id:
      'AJQWtBMVLhWDAbZGN6F0s2xCUCSQKeF9NKqltzRjoNO2VcbEeM9nVoDUW2z3SgXBlVJ7JZIlI62d5iu-iZ_y0c8JvAUXqmuYmJWq-zhrJ-dA',
    driveFileId: '1bvqltjXF7IQcOqfO1uQUUunIJuVkknuV',
  },
  {
    filename: 'Mercedes_VL.jpg',
    lh3Id:
      'AJQWtBNO9IYIu-9y6ksUnegnPY_wgkIKPDpOBBqw6Sq9TSRqMWRd8XKtI3j5bUlcMH5UryQ52FXQg5Ak_u5zxydBkYNVqEq4GgplhQT2IaHd',
    driveFileId: '1zG4H7o6-2N6GWTs9ExJqTdGHBmw-1F-M',
  },
  {
    filename: 'Penske_VL.jpg',
    lh3Id:
      'AJQWtBOojCx--_-xWRfGJm7z_DEn8rS9fWQvQj61sCVDV51WxJ70RzPYu14C-aE0Tma2ZDV3Hz_TGXcz2X5B02Jlb1ttz4U6yvH-pvPMdwEc',
    driveFileId: '1bFLWtldf2GMaeonzhSXilL30KqDhuY6I',
  },
  {
    filename: 'Porshe_VL.jpg',
    lh3Id:
      'AJQWtBOMug90vaPRHBtuxSoPRNy0Niw96oEF0hPkJMKiocxzrBQH0IXN4LNqRSawjyNL8TxsrC2Wbvnd0jspEntCsFv0twJPppOP32BWM9xU',
    driveFileId: '1BEkOdwAR9Kd7wKf77Ad2WkjbudMhh9L_',
  },
  {
    filename: 'REd_Bull_VL.jpg',
    lh3Id:
      'AJQWtBP5wHbIEnFp1pSH3J8SrdekiSl-EUvdlqwRKbbu7IDxbKpIiLw5rzGIGpQMBtDWhQiPxHh1IzRE6hg5qoTfdruERbFI9fT6g8pqqouS',
    driveFileId: '1hRaA2hu6HRbCmMC8w0xwWJts6X91D2Er',
  },
  {
    filename: 'Renaut_VL.jpg',
    lh3Id:
      'AJQWtBMhMQ-DIsS7GG2eTmfVqlXBhuEZcHpBI5WG51M0KTfMqhIsc7ZkuoMKqX13U27fcb9fO_CBUaktbCkUWQvdKegPpKzJmNYEpsfr_IzQ',
    driveFileId: '1UbQHDI0Uf_iu6ujjKw_kDQLeFy4R1nh1',
  },
  {
    filename: 'Sauber_VL.jpg',
    lh3Id:
      'AJQWtBPd14IpwF7821u7-yTPGQwI3jY9EgnVOJbG-5aeF037RXc7pA6nR6rMZYFP1pnCT7jlacy4zPmRxbOHFsFi_jBdwXvV9J3WtiIve6Uw',
    driveFileId: '1ka-3e80SejHFjh0avjPt6SlfygeLivJ0',
  },
  {
    filename: 'Toleman_VL.jpg',
    lh3Id:
      'AJQWtBPjtrAUcfO0EZV7y3pCTUhaDYLOjzLXqss8-Vxo-gKcQ-fe8vPrajz_oYf5hSVHmiAqaeSYuptmw0oQSk7NxQClulmytwzbenT_OnVX',
    driveFileId: '1eMBJkgPSkwqiYIhK_-ZHNp4Au1UrYREb',
  },
  {
    filename: 'Toyota_VL.jpg',
    lh3Id:
      'AJQWtBOb-XOB2xifLoF9MKvPh95dbIznBgbEy4bxaCyyPKd0WEpDOUaTIO_FNPp72MY3DpvOH_LJZXldhkA6njWi78Ls0U4Qam8-bQfUFVPE',
    driveFileId: '1Juhn53H-oNFMll1V_TJZP8UKUOT7ZsUe',
  },
  {
    filename: 'VCarb_VL.jpg',
    lh3Id:
      'AJQWtBNxLxKRVMBPDI0vhlB40YKC5NPZ3tK8AEoefbVRdrQk6jc72jUN3Pn2uPq1VhNmDgR7EbQiGYwTxD-1uTdgxOUYYxMlI2yxOQy-mMZD',
    driveFileId: '1autjA5TA29rZZU_voGBAtWplaYevyWRj',
  },
  {
    filename: 'Williams_VL.jpg',
    lh3Id:
      'AJQWtBM0Qw0FvWN2v2LR084_u0o9tnTgMAajXy5lrSZY6Nm1bn9CHUFHhtDKb-n0xihGqf94NRV58O25RFChLoSuJe3ji86YVdNXZwEa4jsx',
    driveFileId: '1CIxxvSN7rS6YdiK154BZm0Zl_9VIbhNJ',
  },
]

describe('Ingestão Vistas Laterais Google Drive', () => {
  it('baixa todos os 29 arquivos físicos para public/assets/teams/sideviews/', async () => {
    const targetDir = path.resolve(process.cwd(), 'public/assets/teams/sideviews')
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    const downloaded: string[] = []
    const failed: { file: string; error: string; url: string }[] = []

    for (const item of SIDEVIEW_FILES) {
      const destPath = path.join(targetDir, item.filename)

      // Idempotência: se já existe e tem tamanho plausível (> 5KB), não redownload
      if (fs.existsSync(destPath)) {
        const stat = fs.statSync(destPath)
        if (stat.size > 5000) {
          downloaded.push(item.filename)
          continue
        }
      }

      // Tentar s0 primeiro (alta resolução)
      const urlsToTry = [
        `https://lh3.googleusercontent.com/drive-storage/${item.lh3Id}=s0`,
        `https://lh3.googleusercontent.com/drive-storage/${item.lh3Id}`,
        `https://drive.google.com/uc?export=download&id=${item.driveFileId}`,
      ]

      let saved = false
      let lastErr = ''

      for (const url of urlsToTry) {
        try {
          const res = await fetch(url, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          })
          if (!res.ok) {
            lastErr = `HTTP ${res.status} ${res.statusText}`
            continue
          }
          const buf = await res.arrayBuffer()
          if (buf.byteLength < 1000) {
            lastErr = `Buffer muito pequeno (${buf.byteLength} bytes)`
            continue
          }
          fs.writeFileSync(destPath, Buffer.from(buf))
          downloaded.push(item.filename)
          saved = true
          break
        } catch (e: any) {
          lastErr = e?.message || String(e)
        }
      }

      if (!saved) {
        failed.push({
          file: item.filename,
          error: lastErr,
          url: urlsToTry[0],
        })
      }
    }

    console.log(
      `DOWNLOAD REPORT: ${downloaded.length} baixados com sucesso, ${failed.length} falhas.`,
    )
    expect(failed).toEqual([])
    expect(downloaded.length).toBe(SIDEVIEW_FILES.length)
  }, 120000)
})
