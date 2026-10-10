import Link from "next/link";
import { AdminControl, AdminField } from "../controls";
const assetPathPrefix = "/admin-assets";
const imgApprovedIcon = `${assetPathPrefix}/1d14e.svg`;
const imgLayoutAlt01 = `${assetPathPrefix}/3159a.svg`;
const imgCheckVerified03 = `${assetPathPrefix}/bbad0.svg`;
const imgTruck = `${assetPathPrefix}/aac1c.svg`;
const imgTicket01 = `${assetPathPrefix}/4546e.svg`;
const imgMessageSquare01 = `${assetPathPrefix}/2c05e.svg`;
const imgShieldOff = `${assetPathPrefix}/80bce.svg`;
const imgTranslate01 = `${assetPathPrefix}/9b1df.svg`;
const imgSettings02 = `${assetPathPrefix}/a8876.svg`;
const imgSearchIcon = `${assetPathPrefix}/af369.svg`;
const imgBell = `${assetPathPrefix}/182b5.svg`;
const imgHelpCircle = `${assetPathPrefix}/8ed5b.svg`;
const imgLocalizationIcon = `${assetPathPrefix}/924e7.svg`;
const imgTrain = `${assetPathPrefix}/cb928.svg`;
const imgExpand01 = `${assetPathPrefix}/0ec69.svg`;
const imgX = `${assetPathPrefix}/48995.svg`;
const imgPlayCircle = `${assetPathPrefix}/b0f61.svg`;
const imgRecording02 = `${assetPathPrefix}/759fb.svg`;
export default function Component2801Translations() {
  return (
    <div
      className="admin-element-ed8971f7b"
      data-node-id="2521:45837"
      data-name="28.01 · Translations"
    >
      <div className="admin-element-6a9160556" data-node-id="2521:45838" data-name="Staff sidebar">
        <div
          className="admin-element-47aacf6d1"
          data-node-id="2521:45839"
          data-name="Leetlogic identity"
        >
          <div
            className="admin-element-98312d2eb"
            data-node-id="2521:45840"
            data-name="Approved icon"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgApprovedIcon} />
          </div>
          <p className="admin-element-95dcd1624" data-node-id="2521:45843">
            Leetlogic
          </p>
        </div>
        <p
          className="admin-element-d850d511d"
          data-node-id="2521:45844"
          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
        >
          Admin Portal
        </p>
        <div
          className="admin-element-c49082262"
          data-node-id="2521:45845"
          data-name="Staff profile"
        >
          <div className="admin-element-47aacf6d1" data-node-id="2521:45846" data-name="Details">
            <div className="admin-element-fa034075d" data-node-id="2521:45847" data-name="Avatar">
              <p
                className="admin-element-98975eb29"
                data-node-id="2521:45848"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                A
              </p>
            </div>
            <div className="admin-element-d21287ddd" data-node-id="2521:45849" data-name="Identity">
              <p
                className="admin-element-08fd34b76"
                data-node-id="2521:45850"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Amaka
              </p>
              <Link
                className="admin-element-ee7109148"
                data-node-id="2521:45851"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                href="/admin/support"
              >
                Operations / Support O…
              </Link>
            </div>
          </div>
        </div>
        <div
          className="admin-element-fe2923e63"
          data-node-id="2521:45852"
          data-name="Staff navigation"
        >
          <div
            className="admin-element-6ee55dfa3"
            data-node-id="2521:45853"
            data-name="Navigation item"
          >
            <div
              className="admin-element-35368e319"
              data-node-id="2521:45854"
              data-name="layout-alt-01"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutAlt01} />
            </div>
            <Link
              className="admin-element-3f137995b"
              data-node-id="2521:45855"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/dashboard"
            >
              Dashboard
            </Link>
          </div>
          <div
            className="admin-element-6ee55dfa3"
            data-node-id="2521:45856"
            data-name="Navigation item"
          >
            <div
              className="admin-element-35368e319"
              data-node-id="2521:45857"
              data-name="check-verified-03"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgCheckVerified03} />
            </div>
            <Link
              className="admin-element-3f137995b"
              data-node-id="2521:45858"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/verification"
            >
              Verification Queue
            </Link>
          </div>
          <Link
            className="admin-element-6ee55dfa3"
            data-node-id="2521:45859"
            data-name="Navigation item"
            href="/admin/orders"
          >
            <div className="admin-element-35368e319" data-node-id="2521:45860" data-name="truck">
              <img alt="" className="admin-element-8faf267d3" src={imgTruck} />
            </div>
            <span
              className="admin-element-3f137995b"
              data-node-id="2521:45861"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              Orders
            </span>
          </Link>
          <Link
            className="admin-element-6ee55dfa3"
            data-node-id="2521:45862"
            data-name="Navigation item"
            href="/admin/disputes"
          >
            <div
              className="admin-element-35368e319"
              data-node-id="2521:45863"
              data-name="ticket-01"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgTicket01} />
            </div>
            <span
              className="admin-element-3f137995b"
              data-node-id="2521:45864"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >{`Disputes & Tickets`}</span>
          </Link>
          <Link
            className="admin-element-6ee55dfa3"
            data-node-id="2521:45865"
            data-name="Navigation item"
            href="/admin/support/chat"
          >
            <div
              className="admin-element-35368e319"
              data-node-id="2521:45866"
              data-name="message-square-01"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgMessageSquare01} />
            </div>
            <span
              className="admin-element-3f137995b"
              data-node-id="2521:45867"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              Live Chat Console
            </span>
          </Link>
          <div
            className="admin-element-6ee55dfa3"
            data-node-id="2521:45868"
            data-name="Navigation item"
          >
            <div
              className="admin-element-35368e319"
              data-node-id="2521:45869"
              data-name="shield-off"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgShieldOff} />
            </div>
            <Link
              className="admin-element-3f137995b"
              data-node-id="2521:45870"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/risk"
            >{`Fraud & Risk`}</Link>
          </div>
          <Link
            className="admin-element-8168e843e"
            data-node-id="2521:45871"
            data-name="Navigation item"
            href="/admin/translations"
          >
            <div
              className="admin-element-35368e319"
              data-node-id="2521:45872"
              data-name="translate-01"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgTranslate01} />
            </div>
            <span
              className="admin-element-666310f2b"
              data-node-id="2521:45873"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >{`Localization & Translations`}</span>
          </Link>
          <Link
            className="admin-element-6ee55dfa3"
            data-node-id="2521:45874"
            data-name="Navigation item"
            href="/admin/settings"
          >
            <div
              className="admin-element-35368e319"
              data-node-id="2521:45875"
              data-name="settings-02"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgSettings02} />
            </div>
            <span
              className="admin-element-3f137995b"
              data-node-id="2521:45876"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              Staff Settings
            </span>
          </Link>
        </div>
        <div className="admin-element-2858ff3cb" data-node-id="2521:45877" data-name="Session">
          <p
            className="admin-element-9c5c77dce"
            data-node-id="2521:45878"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
          >
            Market v2.4 Active
          </p>
        </div>
      </div>
      <div
        className="admin-element-7c219a7f7"
        data-node-id="2521:45879"
        data-name="Staff workspace"
      >
        <div className="admin-element-5a294230a" data-node-id="2521:45880" data-name="Top bar">
          <div
            className="admin-element-7e8b60cc1"
            data-node-id="2521:45881"
            data-name="Search container"
          >
            <div className="admin-element-c45c17760" data-node-id="2521:45882" data-name="Search">
              <div
                className="admin-element-b2a182ecf"
                data-node-id="2521:45883"
                data-name="Search icon"
              >
                <img alt="" className="admin-element-8faf267d3" src={imgSearchIcon} />
              </div>
              <AdminField
                className="admin-element-db0bc8c58"
                data-node-id="2521:45884"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                label="Search ID, merchant, ticket, or batch..."
                search
              />
            </div>
          </div>
          <div className="admin-element-ad3903416" data-node-id="2521:45885" data-name="Status">
            <p
              className="admin-element-853146de1"
              data-node-id="2521:45886"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              ● Systems Normal · 99.98%
            </p>
          </div>
          <div className="admin-element-35368e319" data-node-id="2521:45887" data-name="bell">
            <img alt="" className="admin-element-8faf267d3" src={imgBell} />
          </div>
          <div
            className="admin-element-35368e319"
            data-node-id="2521:45888"
            data-name="help-circle"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgHelpCircle} />
          </div>
          <p
            className="admin-element-6570fff4b"
            data-node-id="2521:45889"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
          >
            Amaka
          </p>
        </div>
        <div
          className="admin-element-597aaf720"
          data-node-id="2521:45890"
          data-name="Workspace content"
        >
          <p
            className="admin-element-4ca3fb38c"
            data-node-id="2521:45891"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
          >{`Admin Console › Regional Operations › Localization & Strings Engine`}</p>
          <div
            className="admin-element-e76760c0d"
            data-node-id="2521:45892"
            data-name="Localization overview"
          >
            <div className="admin-element-47aacf6d1" data-node-id="2521:45893" data-name="Details">
              <div
                className="admin-element-3bf226251"
                data-node-id="2521:45894"
                data-name="Overview"
              >
                <p
                  className="admin-element-104d7f070"
                  data-node-id="2521:45895"
                >{`Localization & Language Strings`}</p>
                <p
                  className="admin-element-4c1fa568e"
                  data-node-id="2521:45896"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Manage multilingual translations for English, Hausa, Yoruba, and Igbo agricultural
                  interfaces
                </p>
              </div>
              <div className="admin-element-61426f31e" data-node-id="2521:45897" data-name="Status">
                <p
                  className="admin-element-5d78ec74b"
                  data-node-id="2521:45898"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  I18N HUB
                </p>
              </div>
              <div
                className="admin-element-e88c9a5af"
                data-node-id="2521:45899"
                data-name="Actions"
              >
                <AdminControl
                  className="admin-element-4a9ad909c"
                  data-node-id="2521:45900"
                  data-name="Secondary action"
                >
                  <p
                    className="admin-element-ccf92a798"
                    data-node-id="2521:45901"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Export language pack (.json)
                  </p>
                </AdminControl>
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:45902"
                  data-name="Details"
                >
                  <AdminControl
                    className="admin-element-b9b1984f4"
                    data-node-id="2521:45903"
                    data-name="Secondary action"
                  >
                    <p
                      className="admin-element-ccf92a798"
                      data-node-id="2521:45904"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Import PO file
                    </p>
                  </AdminControl>
                  <AdminControl
                    className="admin-element-d7e789040"
                    data-node-id="2521:45905"
                    data-name="Primary action"
                  >
                    <div
                      className="admin-element-4713e3706"
                      data-node-id="I2521:45905;2521:20144"
                      data-name="Button:shadow"
                    />
                    <div
                      className="admin-element-9a39a55c2"
                      data-node-id="I2521:45905;2521:20145"
                      data-name="Container"
                    >
                      <div
                        className="admin-element-a47f45dc6"
                        data-node-id="I2521:45905;2521:20146"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        <p className="admin-element-f62dcabf0">+ Add string</p>
                      </div>
                    </div>
                  </AdminControl>
                </div>
              </div>
            </div>
            <div
              className="admin-element-47aacf6d1"
              data-node-id="2521:45906"
              data-name="Language tabs"
            >
              <div className="admin-element-61426f31e" data-node-id="2521:45907" data-name="Status">
                <p
                  className="admin-element-5d78ec74b"
                  data-node-id="2521:45908"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Igbo (Asụsụ Igbo) 94%
                </p>
              </div>
              <div className="admin-element-d0d06bbd0" data-node-id="2521:45909" data-name="Status">
                <p
                  className="admin-element-5d78ec74b"
                  data-node-id="2521:45910"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Hausa (Harshen Hausa) 88%
                </p>
              </div>
              <div className="admin-element-d0d06bbd0" data-node-id="2521:45911" data-name="Status">
                <p
                  className="admin-element-5d78ec74b"
                  data-node-id="2521:45912"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Yoruba (Èdè Yorùbá) 91%
                </p>
              </div>
              <div className="admin-element-d0d06bbd0" data-node-id="2521:45913" data-name="Status">
                <p
                  className="admin-element-5d78ec74b"
                  data-node-id="2521:45914"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Nige…
                </p>
              </div>
            </div>
            <div
              className="admin-element-9e9fdaf20"
              data-node-id="2521:45915"
              data-name="Translation progress"
            >
              <div
                className="admin-element-47aacf6d1"
                data-node-id="2521:45916"
                data-name="Details"
              >
                <div
                  className="admin-element-eaa60f1c4"
                  data-node-id="2521:45917"
                  data-name="Localization icon"
                >
                  <img alt="" className="admin-element-8faf267d3" src={imgLocalizationIcon} />
                </div>
                <div
                  className="admin-element-cba405628"
                  data-node-id="2521:45918"
                  data-name="Completion"
                >
                  <p
                    className="admin-element-b2eb77036"
                    data-node-id="2521:45919"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Igbo translation: 94% complete
                  </p>
                  <p
                    className="admin-element-4ca3fb38c"
                    data-node-id="2521:45920"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    (1,248 / 1,320 strings translated • 6 need review)
                  </p>
                  <div
                    className="admin-element-9f7cd5cdd"
                    data-node-id="2521:45921"
                    data-name="Progress"
                  >
                    <div
                      className="admin-element-2d146422f"
                      data-node-id="2521:45922"
                      data-name="Completed"
                    />
                  </div>
                </div>
                <p
                  className="admin-element-36ed21447"
                  data-node-id="2521:45923"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  72 pending / unverified
                </p>
                <p
                  className="admin-element-916f294fe"
                  data-node-id="2521:45924"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >{`● Approved   ● Needs review   ● Untranslated`}</p>
              </div>
            </div>
          </div>
          <div
            className="admin-element-87601b9de"
            data-node-id="2521:45925"
            data-name="Strings and review"
          >
            <div
              className="admin-element-343d18b22"
              data-node-id="2521:45926"
              data-name="Translation inventory"
            >
              <div
                className="admin-element-29067dffe"
                data-node-id="2521:45927"
                data-name="Filters"
              >
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:45928"
                  data-name="Details"
                >
                  <div
                    className="admin-element-c45c17760"
                    data-node-id="2521:45929"
                    data-name="Search"
                  >
                    <div
                      className="admin-element-b2a182ecf"
                      data-node-id="2521:45930"
                      data-name="Search icon"
                    >
                      <img alt="" className="admin-element-8faf267d3" src={imgSearchIcon} />
                    </div>
                    <p
                      className="admin-element-db0bc8c58"
                      data-node-id="2521:45931"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      escrow.
                    </p>
                  </div>
                  <div
                    className="admin-element-d0d06bbd0"
                    data-node-id="2521:45932"
                    data-name="Status"
                  >
                    <p
                      className="admin-element-5d78ec74b"
                      data-node-id="2521:45933"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      All (1,320)
                    </p>
                  </div>
                  <div
                    className="admin-element-3ecb999ef"
                    data-node-id="2521:45934"
                    data-name="Status"
                  >
                    <p
                      className="admin-element-a3c2d98c9"
                      data-node-id="2521:45935"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Needs review (6)
                    </p>
                  </div>
                  <div
                    className="admin-element-d0d06bbd0"
                    data-node-id="2521:45936"
                    data-name="Status"
                  >
                    <p
                      className="admin-element-5d78ec74b"
                      data-node-id="2521:45937"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Approved (1,242)
                    </p>
                  </div>
                  <div
                    className="admin-element-d0d06bbd0"
                    data-node-id="2521:45938"
                    data-name="Status"
                  >
                    <p
                      className="admin-element-5d78ec74b"
                      data-node-id="2521:45939"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Missing (72)
                    </p>
                  </div>
                </div>
              </div>
              <div
                className="admin-element-437d7ab0c"
                data-node-id="2521:45940"
                data-name="Strings table"
              >
                <div
                  className="admin-element-46fe7a4f5"
                  data-node-id="2521:45941"
                  data-name="Table headings"
                >
                  <p
                    className="admin-element-91cc251d4"
                    data-node-id="2521:45942"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    String ID / Key
                  </p>
                  <p
                    className="admin-element-097e9474e"
                    data-node-id="2521:45943"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Context / Screen
                  </p>
                  <p
                    className="admin-element-4a9b73a3b"
                    data-node-id="2521:45944"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    English (Source)
                  </p>
                  <p
                    className="admin-element-4a9b73a3b"
                    data-node-id="2521:45945"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Igbo Translation (Target)
                  </p>
                </div>
                <div
                  className="admin-element-6baff759a"
                  data-node-id="2521:45946"
                  data-name="Translation row"
                >
                  <div
                    className="admin-element-ed33592d7"
                    data-node-id="2521:45947"
                    data-name="String identity"
                  >
                    <p
                      className="admin-element-1c973d69b"
                      data-node-id="2521:45948"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      escrow.payment.held_notice
                    </p>
                    <p
                      className="admin-element-9376a98d0"
                      data-node-id="2521:45949"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      v1.2 • Core Trade
                    </p>
                  </div>
                  <p
                    className="admin-element-40b74f667"
                    data-node-id="2521:45950"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Buyer Checkout / Payment Held
                  </p>
                  <p
                    className="admin-element-67bac2de9"
                    data-node-id="2521:45951"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Payment is held until delivery
                  </p>
                  <div
                    className="admin-element-dc2642adf"
                    data-node-id="2521:45952"
                    data-name="Target translation"
                  >
                    <p
                      className="admin-element-ea0a179c0"
                      data-node-id="2521:45953"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      A na-ejide ego ruo mgbe enyere ngwaahịạ
                    </p>
                    <p
                      className="admin-element-b2129a0c1"
                      data-node-id="2521:45954"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Anambra vs Imo phrasing check
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-8bc2f4f96"
                  data-node-id="2521:45955"
                  data-name="Translation row"
                >
                  <div
                    className="admin-element-659f7b256"
                    data-node-id="2521:45956"
                    data-name="String identity"
                  >
                    <p
                      className="admin-element-1c973d69b"
                      data-node-id="2521:45957"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      farmer.listing.harvest_date
                    </p>
                    <p
                      className="admin-element-9376a98d0"
                      data-node-id="2521:45958"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      v1.0 • Listing
                    </p>
                  </div>
                  <p
                    className="admin-element-50a96e79f"
                    data-node-id="2521:45959"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Produce Listing / Harvest Date
                  </p>
                  <p
                    className="admin-element-b109a6467"
                    data-node-id="2521:45960"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Harvest date
                  </p>
                  <div
                    className="admin-element-2cccba0c3"
                    data-node-id="2521:45961"
                    data-name="Target translation"
                  >
                    <p
                      className="admin-element-f0f03052c"
                      data-node-id="2521:45962"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Ụbọchị owuwe ihe ubi
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-8bc2f4f96"
                  data-node-id="2521:45963"
                  data-name="Translation row"
                >
                  <div
                    className="admin-element-659f7b256"
                    data-node-id="2521:45964"
                    data-name="String identity"
                  >
                    <p
                      className="admin-element-1c973d69b"
                      data-node-id="2521:45965"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      order.status.in_transit
                    </p>
                    <p
                      className="admin-element-9376a98d0"
                      data-node-id="2521:45966"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      v2.1 • Delivery
                    </p>
                  </div>
                  <p
                    className="admin-element-50a96e79f"
                    data-node-id="2521:45967"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Logistics / Live Tracking
                  </p>
                  <p
                    className="admin-element-b109a6467"
                    data-node-id="2521:45968"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    In transit
                  </p>
                  <div
                    className="admin-element-2cccba0c3"
                    data-node-id="2521:45969"
                    data-name="Target translation"
                  >
                    <p
                      className="admin-element-f0f03052c"
                      data-node-id="2521:45970"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      N’ụzọ na-abịa
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-8bc2f4f96"
                  data-node-id="2521:45971"
                  data-name="Translation row"
                >
                  <div
                    className="admin-element-659f7b256"
                    data-node-id="2521:45972"
                    data-name="String identity"
                  >
                    <p
                      className="admin-element-1c973d69b"
                      data-node-id="2521:45973"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      dispute.action.refund_buyer
                    </p>
                    <p
                      className="admin-element-9376a98d0"
                      data-node-id="2521:45974"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      v1.3 • Resolution
                    </p>
                  </div>
                  <p
                    className="admin-element-50a96e79f"
                    data-node-id="2521:45975"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Dispute Resolution / Escrow
                  </p>
                  <p
                    className="admin-element-b109a6467"
                    data-node-id="2521:45976"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Refund buyer
                  </p>
                  <div
                    className="admin-element-2cccba0c3"
                    data-node-id="2521:45977"
                    data-name="Target translation"
                  >
                    <p
                      className="admin-element-f0f03052c"
                      data-node-id="2521:45978"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Weghachi onye zụrụ ego
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-8bc2f4f96"
                  data-node-id="2521:45979"
                  data-name="Translation row"
                >
                  <div
                    className="admin-element-659f7b256"
                    data-node-id="2521:45980"
                    data-name="String identity"
                  >
                    <p
                      className="admin-element-1c973d69b"
                      data-node-id="2521:45981"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      auth.pin.enter_code
                    </p>
                    <p
                      className="admin-element-9376a98d0"
                      data-node-id="2521:45982"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      v2.0 • Security
                    </p>
                  </div>
                  <p
                    className="admin-element-50a96e79f"
                    data-node-id="2521:45983"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Staff / Farmer Onboarding
                  </p>
                  <p
                    className="admin-element-b109a6467"
                    data-node-id="2521:45984"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Enter security code
                  </p>
                  <div
                    className="admin-element-2cccba0c3"
                    data-node-id="2521:45985"
                    data-name="Target translation"
                  >
                    <p
                      className="admin-element-f0f03052c"
                      data-node-id="2521:45986"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Tinye koodu nchedo
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-a09965ab9"
                  data-node-id="2521:45987"
                  data-name="Pagination"
                >
                  <p
                    className="admin-element-4a9b73a3b"
                    data-node-id="2521:45988"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Showing 1 to 5 of 1,320 strings (Filtered for Igbo)
                  </p>
                  <p
                    className="admin-element-efba0b4f1"
                    data-node-id="2521:45989"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >{`‹   1   2   3   …   264   ›`}</p>
                </div>
              </div>
              <div
                className="admin-element-ecfa56617"
                data-node-id="2521:45990"
                data-name="Dialectal concordance checker"
              >
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:45991"
                  data-name="Details"
                >
                  <div
                    className="admin-element-35368e319"
                    data-node-id="2521:45992"
                    data-name="train"
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgTrain} />
                  </div>
                  <div
                    className="admin-element-cba405628"
                    data-node-id="2521:45993"
                    data-name="Concordance"
                  >
                    <p className="admin-element-be5e2fcd0" data-node-id="2521:45994">
                      Dialectal Concordance Checker
                    </p>
                    <p
                      className="admin-element-aaa436472"
                      data-node-id="2521:45995"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Central Igbo (Igbo Izugbe) standard is enforced while providing agricultural
                      glossaries tailored for Onitsha and Aba grain markets.
                    </p>
                    <div
                      className="admin-element-47aacf6d1"
                      data-node-id="2521:45996"
                      data-name="Details"
                    >
                      <p
                        className="admin-element-57afd4192"
                        data-node-id="2521:45997"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        Model Confidence: 98.4%
                      </p>
                      <div
                        className="admin-element-61426f31e"
                        data-node-id="2521:45998"
                        data-name="Status"
                      >
                        <p
                          className="admin-element-5d78ec74b"
                          data-node-id="2521:45999"
                          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                        >
                          Izugbe Approved
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              className="admin-element-e84e758b8"
              data-node-id="2521:46000"
              data-name="Review column"
            >
              <div
                className="admin-element-ee07df12f"
                data-node-id="2521:46001"
                data-name="Translation review card"
              >
                <div
                  className="admin-element-47aacf6d1"
                  data-node-id="2521:46002"
                  data-name="Details"
                >
                  <div
                    className="admin-element-3ecb999ef"
                    data-node-id="2521:46003"
                    data-name="Status"
                  >
                    <p
                      className="admin-element-a3c2d98c9"
                      data-node-id="2521:46004"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Review Queue #1 of 6
                    </p>
                  </div>
                  <div
                    className="admin-element-35368e319"
                    data-node-id="2521:46005"
                    data-name="expand-01"
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgExpand01} />
                  </div>
                  <div className="admin-element-35368e319" data-node-id="2521:46006" data-name="x">
                    <img alt="" className="admin-element-8faf267d3" src={imgX} />
                  </div>
                </div>
                <p
                  className="admin-element-c86d6a855"
                  data-node-id="2521:46007"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  escrow.payment.held_notice
                </p>
                <p
                  className="admin-element-4ca3fb38c"
                  data-node-id="2521:46008"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Screen: Buyer Checkout • Escrow Protection Alert
                </p>
                <div
                  className="admin-element-7717ec256"
                  data-node-id="2521:46009"
                  data-name="Source language"
                >
                  <p
                    className="admin-element-68e7d3268"
                    data-node-id="2521:46010"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    SOURCE LANGUAGE (ENGLISH) · Default
                  </p>
                  <p
                    className="admin-element-1bc30747f"
                    data-node-id="2521:46011"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Payment is held until delivery
                  </p>
                </div>
                <div
                  className="admin-element-fb733956f"
                  data-node-id="2521:46012"
                  data-name="Target language"
                >
                  <p
                    className="admin-element-4cf17bee7"
                    data-node-id="2521:46013"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    TARGET: IGBO (ASỤSỤ IGBO) · Needs Verification
                  </p>
                  <div
                    className="admin-element-62f39da6b"
                    data-node-id="2521:46014"
                    data-name="Setting field"
                  >
                    <p className="admin-element-79e11b5fe" data-node-id="2521:46015">
                      ​
                    </p>
                    <div
                      className="admin-element-153c0a180"
                      data-node-id="2521:46016"
                      data-name="Value"
                    >
                      <AdminField
                        className="admin-element-011d44306"
                        data-node-id="I2521:46016;1091:63786"
                        data-name="_Input field base"
                        initialValue="A na-ejide ego ruo mgbe enyere ngwaahịạ"
                        label="​"
                      />
                    </div>
                  </div>
                  <p
                    className="admin-element-4ca3fb38c"
                    data-node-id="2521:46017"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    41 characters • Proper diacritics checked
                  </p>
                  <p
                    className="admin-element-4cf17bee7"
                    data-node-id="2521:46018"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Revert to initial
                  </p>
                </div>
                <div
                  className="admin-element-e6787526a"
                  data-node-id="2521:46019"
                  data-name="Agricultural context and dialect note"
                >
                  <p
                    className="admin-element-62dd9dde8"
                    data-node-id="2521:46020"
                  >{`Agricultural Context & Dialect Note`}</p>
                  <p
                    className="admin-element-e4e524367"
                    data-node-id="2521:46021"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >{`Ensure produce terms are clear for farmers in Ebonyi, Enugu, and Anambra. Use "ngwaahịạ" (produce/goods) rather than loan words to preserve clarity during high-value yam and grain transactions.`}</p>
                </div>
                <div
                  className="admin-element-9d8b1466d"
                  data-node-id="2521:46022"
                  data-name="Voice playback"
                >
                  <div
                    className="admin-element-47aacf6d1"
                    data-node-id="2521:46023"
                    data-name="Details"
                  >
                    <div
                      className="admin-element-35368e319"
                      data-node-id="2521:46024"
                      data-name="play-circle"
                    >
                      <img alt="" className="admin-element-8faf267d3" src={imgPlayCircle} />
                    </div>
                    <div
                      className="admin-element-f06f3a4af"
                      data-node-id="2521:46025"
                      data-name="Voice"
                    >
                      <p
                        className="admin-element-fc65763f1"
                        data-node-id="2521:46026"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        Playback voice recording
                      </p>
                      <p
                        className="admin-element-5a7d6aeb8"
                        data-node-id="2521:46027"
                        style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                      >
                        TTS Engine · Igbo Neutral Voice (Aba Accent)
                      </p>
                    </div>
                    <div
                      className="admin-element-35368e319"
                      data-node-id="2521:46028"
                      data-name="recording-02"
                    >
                      <img alt="" className="admin-element-8faf267d3" src={imgRecording02} />
                    </div>
                  </div>
                </div>
                <p
                  className="admin-element-4ca3fb38c"
                  data-node-id="2521:46029"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Suggested by: Chinedu O. (Senior Linguist)
                </p>
                <p
                  className="admin-element-4ca3fb38c"
                  data-node-id="2521:46030"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Reviewed: Today, 11:20 AM
                </p>
                <AdminControl
                  className="admin-element-3b377d908"
                  data-node-id="2521:46031"
                  data-name="Primary action"
                >
                  <div
                    className="admin-element-4713e3706"
                    data-node-id="I2521:46031;2521:20144"
                    data-name="Button:shadow"
                  />
                  <div
                    className="admin-element-9a39a55c2"
                    data-node-id="I2521:46031;2521:20145"
                    data-name="Container"
                  >
                    <div
                      className="admin-element-a47f45dc6"
                      data-node-id="I2521:46031;2521:20146"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      <p className="admin-element-f62dcabf0">Approve translation</p>
                    </div>
                  </div>
                </AdminControl>
                <AdminControl
                  className="admin-element-4a9ad909c"
                  data-node-id="2521:46032"
                  data-name="Secondary action"
                >
                  <p
                    className="admin-element-ccf92a798"
                    data-node-id="2521:46033"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >{`Reject & Request Re-translation`}</p>
                </AdminControl>
              </div>
              <div
                className="admin-element-8da19a0c3"
                data-node-id="2521:46034"
                data-name="Translator protocol"
              >
                <p className="admin-element-04a337cca" data-node-id="2521:46035">
                  Translator Protocol • Leetlogic
                </p>
                <p
                  className="admin-element-4c3e64b64"
                  data-node-id="2521:46036"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >{`Always preserve curly parameters like {amount} and {crop_type} intact to avoid crash states in mobile clients.`}</p>
              </div>
            </div>
          </div>
          <div className="admin-element-47aacf6d1" data-node-id="2521:46037" data-name="Details">
            <div className="admin-element-61426f31e" data-node-id="2521:46038" data-name="Status">
              <p
                className="admin-element-5d78ec74b"
                data-node-id="2521:46039"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Sync Target: Mobile Client v2.4.9
              </p>
            </div>
            <p
              className="admin-element-57afd4192"
              data-node-id="2521:46040"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              Auto-saved 2m ago
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
