import Link from "next/link";
import { AdminControl, AdminField } from "../controls";
const assetPathPrefix = "/admin-assets";
const imgSelectedCheckmark = `${assetPathPrefix}/b2672.svg`;
const imgLeetlogicIcon = `${assetPathPrefix}/f4d0e.svg`;
const imgLayoutGrid01 = `${assetPathPrefix}/a643b.svg`;
const imgCheckVerified03 = `${assetPathPrefix}/7efeb.svg`;
const imgArchive = `${assetPathPrefix}/d19a5.svg`;
const imgTruck = `${assetPathPrefix}/b8b77.svg`;
const imgSearch = `${assetPathPrefix}/ec41f.svg`;
const imgBell = `${assetPathPrefix}/6fe5a.svg`;
const imgSearch1 = `${assetPathPrefix}/8623b.svg`;
const imgRefreshCw = `${assetPathPrefix}/9cdbf.svg`;
const imgReviewSegment = `${assetPathPrefix}/84bf1.svg`;
const imgFlaggedSegment = `${assetPathPrefix}/d7ba3.svg`;
const imgWaitingSegment = `${assetPathPrefix}/20445.svg`;
type LeetlogicIOsSelectableFilterChipProps = {
  className?: string;
  label?: string;
  state?: "Active" | "Passive";
};
function LeetlogicIOsSelectableFilterChip({
  className,
  label = "Active",
  state = "Active",
}: LeetlogicIOsSelectableFilterChipProps) {
  const isActive = state === "Active";
  const isPassive = state === "Passive";
  return (
    <AdminControl
      className={
        className ||
        `admin-element-56d772759 ${isPassive ? "admin-element-bfb7f249f" : "admin-element-84cd9c89c"}`
      }
      data-name="Filter chip"
    >
      {isActive && (
        <>
          <div
            className="admin-element-f23e39f62"
            data-node-id="2521:20783"
            data-name="Selected checkmark"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgSelectedCheckmark} />
          </div>
          <p
            className="admin-element-d48a49448"
            data-node-id="2521:20785"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
          >
            {label}
          </p>
        </>
      )}
      {isPassive && (
        <p
          className="admin-element-ffdc6facd"
          data-node-id="2521:20787"
          style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
        >
          {label}
        </p>
      )}
    </AdminControl>
  );
}
export default function Component2001FarmerQueue() {
  return (
    <div
      className="admin-element-ed8971f7b"
      data-node-id="2521:42686"
      data-name="20.01 · Farmer queue"
    >
      <div
        className="admin-element-e005f6fd7"
        data-node-id="2521:42687"
        data-name="Staff navigation"
      >
        <div
          className="admin-element-88cb7a7b8"
          data-node-id="2521:42688"
          data-name="Approved brand"
        >
          <div
            className="admin-element-2d3663d59"
            data-node-id="2521:42689"
            data-name="Leetlogic icon"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgLeetlogicIcon} />
          </div>
          <p className="admin-element-0ead7d866" data-node-id="2521:42692">
            Leetlogic
          </p>
        </div>
        <p className="admin-element-1150e9f94" data-node-id="2521:42693">
          Staff Operations
        </p>
        <div
          className="admin-element-109669e20"
          data-node-id="2521:42694"
          data-name="Staff identity"
        >
          <p className="admin-element-246542440" data-node-id="2521:42695">
            Amaka
          </p>
          <p className="admin-element-aed606b87" data-node-id="2521:42696">
            Operations Officer
          </p>
        </div>
        <div
          className="admin-element-c94ed62b9"
          data-node-id="2521:42697"
          data-name="Navigation items"
        >
          <div
            className="admin-element-5301e7ea7"
            data-node-id="2521:42698"
            data-name="Navigation item"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:42699"
              data-name="layout-grid-01"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid01} />
            </div>
            <Link
              className="admin-element-ed5726f4c"
              data-node-id="2521:42700"
              href="/admin/dashboard"
            >
              Dashboard
            </Link>
          </div>
          <Link
            className="admin-element-826a38a85"
            data-node-id="2521:42701"
            data-name="Navigation item"
            href="/admin/verification"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:42702"
              data-name="check-verified-03"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgCheckVerified03} />
            </div>
            <span
              className="admin-element-98ce90ff3"
              data-node-id="2521:42703"
            >{`Verification Queue  12`}</span>
          </Link>
          <div
            className="admin-element-5301e7ea7"
            data-node-id="2521:42704"
            data-name="Navigation item"
          >
            <div className="admin-element-b2a182ecf" data-node-id="2521:42705" data-name="archive">
              <img alt="" className="admin-element-8faf267d3" src={imgArchive} />
            </div>
            <Link
              className="admin-element-ed5726f4c"
              data-node-id="2521:42706"
              href="/admin/listings"
            >
              Listings
            </Link>
          </div>
          <Link
            className="admin-element-5301e7ea7"
            data-node-id="2521:42707"
            data-name="Navigation item"
            href="/admin/orders"
          >
            <div className="admin-element-b2a182ecf" data-node-id="2521:42708" data-name="truck">
              <img alt="" className="admin-element-8faf267d3" src={imgTruck} />
            </div>
            <span className="admin-element-ed5726f4c" data-node-id="2521:42709">
              Orders
            </span>
          </Link>
          <Link
            className="admin-element-5301e7ea7"
            data-node-id="2521:42710"
            data-name="Navigation item"
            href="/admin/disputes"
          >
            <div
              className="admin-element-b2a182ecf"
              data-node-id="2521:42711"
              data-name="layout-grid-01"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid01} />
            </div>
            <span
              className="admin-element-ed5726f4c"
              data-node-id="2521:42712"
            >{`Disputes & Support`}</span>
          </Link>
        </div>
        <div
          className="admin-element-f9647d935"
          data-node-id="2521:42713"
          data-name="Portal utilities"
        >
          <Link
            className="admin-element-92dd2d44e"
            data-node-id="2521:42714"
            href="/admin/settings"
          >{`⚙  Staff Settings`}</Link>
          <Link className="admin-element-67366dcb7" data-node-id="2521:42715" href="/admin/login">
            Log Out
          </Link>
        </div>
      </div>
      <div
        className="admin-element-b36e1be32"
        data-node-id="2521:42716"
        data-name="Queue workspace"
      >
        <div
          className="admin-element-8d6799bad"
          data-node-id="2521:42717"
          data-name="Staff toolbar"
        >
          <div
            className="admin-element-34d33d007"
            data-node-id="2521:42718"
            data-name="Status badge"
          >
            <div
              className="admin-element-f9034e18a"
              data-node-id="I2521:42718;1046:4838"
              data-name="_Badge base"
            >
              <p className="admin-element-157c991da" data-node-id="I2521:42718;1046:4838;1046:26">
                ● System Active · Lagos DC
              </p>
            </div>
          </div>
          <div
            className="admin-element-b68cea1c5"
            data-node-id="2521:42719"
            data-name="Global search"
          >
            <div className="admin-element-b2a182ecf" data-node-id="2521:42720" data-name="search">
              <img alt="" className="admin-element-8faf267d3" src={imgSearch} />
            </div>
            <AdminField
              className="admin-element-0830ab4ee"
              data-node-id="2521:42721"
              label="Search farmer, buyer, batch ID..."
              search
            />
          </div>
          <div className="admin-element-eaa60f1c4" data-node-id="2521:42722" data-name="bell">
            <img alt="" className="admin-element-8faf267d3" src={imgBell} />
          </div>
          <div className="admin-element-e6ca5b297" data-node-id="2521:42723">
            <p className="admin-element-96eff31b5">Amaka</p>
            <p className="admin-element-a4d2b1ada">Admin</p>
          </div>
        </div>
        <div
          className="admin-element-9a5e76aab"
          data-node-id="2521:42724"
          data-name="Queue heading"
        >
          <div
            className="admin-element-990094099"
            data-node-id="2521:42725"
            data-name="Heading copy"
          >
            <p className="admin-element-0f9f6c338" data-node-id="2521:42726">
              Nigeria Operations · KYF Hub • Real-time Tier-1 Validation
            </p>
            <p className="admin-element-2e7becf45" data-node-id="2521:42727">
              Farmer verification queue
            </p>
            <p className="admin-element-6ed1181c5" data-node-id="2521:42728">
              Review pending Nigerian farmer onboarding submissions and identity documents.
            </p>
          </div>
          <div className="admin-element-294176bbf" data-node-id="2521:42729" data-name="SLA target">
            <p className="admin-element-e6bfeee35" data-node-id="2521:42730">
              SLA Target
            </p>
            <p className="admin-element-ab896fbf6" data-node-id="2521:42731">
              ＜45m
            </p>
          </div>
          <div
            className="admin-element-294176bbf"
            data-node-id="2521:42732"
            data-name="Pending total"
          >
            <p className="admin-element-e6bfeee35" data-node-id="2521:42733">
              Pending Today
            </p>
            <p className="admin-element-ab896fbf6" data-node-id="2521:42734">
              14
            </p>
          </div>
        </div>
        <div
          className="admin-element-320438258"
          data-node-id="2521:42735"
          data-name="Verification filters"
        >
          <div className="admin-element-048b51150" data-node-id="2521:42736" data-name="Filters">
            <LeetlogicIOsSelectableFilterChip className="admin-element-3b644e38b" label="All 14" />
            <LeetlogicIOsSelectableFilterChip
              className="admin-element-46d84f92c"
              label="ID waiting 8"
              state="Passive"
            />
            <LeetlogicIOsSelectableFilterChip
              className="admin-element-46d84f92c"
              label="Selfie review 3"
              state="Passive"
            />
            <LeetlogicIOsSelectableFilterChip
              className="admin-element-46d84f92c"
              label="Flagged"
              state="Passive"
            />
            <div
              className="admin-element-bff64daf5"
              data-node-id="2521:42741"
              data-name="Farmer search"
            >
              <div className="admin-element-58d29b27c" data-node-id="2521:42742" data-name="search">
                <img alt="" className="admin-element-8faf267d3" src={imgSearch1} />
              </div>
              <AdminField
                className="admin-element-92889204c"
                data-node-id="2521:42743"
                label="Search farmer name, LGA, state, or"
                search
              />
            </div>
            <div
              className="admin-element-34d33d007"
              data-node-id="2521:42744"
              data-name="Status badge"
            >
              <div
                className="admin-element-45367f628"
                data-node-id="I2521:42744;1046:4838"
                data-name="_Badge base"
              >
                <p className="admin-element-7222d49ee" data-node-id="I2521:42744;1046:4838;1046:26">
                  All States⌄
                </p>
              </div>
            </div>
            <div
              className="admin-element-eaa60f1c4"
              data-node-id="2521:42745"
              data-name="refresh-cw"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgRefreshCw} />
            </div>
          </div>
        </div>
        <div
          className="admin-element-153c0a180"
          data-node-id="2521:42746"
          data-name="Verification queue"
        >
          <div
            className="admin-element-672ce128e"
            data-node-id="2521:42747"
            data-name="Farmer verification table specimen"
          >
            <div
              className="admin-element-704252aea"
              data-node-id="I2521:42747;1227:108549"
              data-name="Content"
            >
              <div
                className="admin-element-95773e0af"
                data-node-id="I2521:42747;1225:108376"
                data-name="Column"
              >
                <div
                  className="admin-element-d65fbd0f7"
                  data-node-id="I2521:42747;1224:5566"
                  data-name="Table header cell"
                >
                  <div
                    className="admin-element-e8210ba62"
                    data-node-id="I2521:42747;1224:5566;1221:107935"
                    data-name="Table header"
                  >
                    <p
                      className="admin-element-afdb1c62e"
                      data-node-id="I2521:42747;1224:5566;1221:107935;1221:106781"
                    >{`Farmer name & contact`}</p>
                  </div>
                </div>
                <div
                  className="admin-element-2f6385a38"
                  data-node-id="I2521:42747;1225:108334"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-36a8c006b"
                    data-node-id="I2521:42747;1225:108334;1224:5905"
                    data-name="Avatar"
                  >
                    <p
                      className="admin-element-79dfc47d0"
                      data-node-id="I2521:42747;1225:108334;1224:5905;19:1257"
                    >
                      CS
                    </p>
                  </div>
                  <div
                    className="admin-element-5d5d43aaf"
                    data-node-id="I2521:42747;1225:108334;1224:5906"
                    data-name="Text and supporting text"
                  >
                    <Link
                      className="admin-element-c07ca1908"
                      data-node-id="I2521:42747;1225:108334;1224:5907"
                      href="/admin/verification/farmer"
                    >
                      Chibuzor Simon
                    </Link>
                    <p
                      className="admin-element-3ddb9fc65"
                      data-node-id="I2521:42747;1225:108334;1224:5908"
                    >
                      +234 803 555 0142
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-2f6385a38"
                  data-node-id="I2521:42747;1225:108388"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-1215eb409"
                    data-node-id="I2521:42747;1225:108388;1224:5905"
                    data-name="Avatar"
                  >
                    <p
                      className="admin-element-7611ec857"
                      data-node-id="I2521:42747;1225:108388;1224:5905;19:1257"
                    >
                      AB
                    </p>
                  </div>
                  <div
                    className="admin-element-5d5d43aaf"
                    data-node-id="I2521:42747;1225:108388;1224:5906"
                    data-name="Text and supporting text"
                  >
                    <p
                      className="admin-element-c07ca1908"
                      data-node-id="I2521:42747;1225:108388;1224:5907"
                    >
                      Amina Bello
                    </p>
                    <p
                      className="admin-element-3ddb9fc65"
                      data-node-id="I2521:42747;1225:108388;1224:5908"
                    >
                      +234 814 309 8812
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-2f6385a38"
                  data-node-id="I2521:42747;1226:1"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-1215eb409"
                    data-node-id="I2521:42747;1226:1;1224:5905"
                    data-name="Avatar"
                  >
                    <p
                      className="admin-element-7611ec857"
                      data-node-id="I2521:42747;1226:1;1224:5905;19:1257"
                    >
                      SE
                    </p>
                  </div>
                  <div
                    className="admin-element-5d5d43aaf"
                    data-node-id="I2521:42747;1226:1;1224:5906"
                    data-name="Text and supporting text"
                  >
                    <p
                      className="admin-element-c07ca1908"
                      data-node-id="I2521:42747;1226:1;1224:5907"
                    >
                      Sunday Eze
                    </p>
                    <p
                      className="admin-element-3ddb9fc65"
                      data-node-id="I2521:42747;1226:1;1224:5908"
                    >
                      +234 705 918 3440
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-2f6385a38"
                  data-node-id="I2521:42747;1226:9"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-1215eb409"
                    data-node-id="I2521:42747;1226:9;1224:5905"
                    data-name="Avatar"
                  >
                    <p
                      className="admin-element-7611ec857"
                      data-node-id="I2521:42747;1226:9;1224:5905;19:1257"
                    >
                      IM
                    </p>
                  </div>
                  <div
                    className="admin-element-5d5d43aaf"
                    data-node-id="I2521:42747;1226:9;1224:5906"
                    data-name="Text and supporting text"
                  >
                    <p
                      className="admin-element-c07ca1908"
                      data-node-id="I2521:42747;1226:9;1224:5907"
                    >
                      Ibrahim Musa
                    </p>
                    <p
                      className="admin-element-3ddb9fc65"
                      data-node-id="I2521:42747;1226:9;1224:5908"
                    >
                      +234 802 119 7500
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-2f6385a38"
                  data-node-id="I2521:42747;1226:17"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-882e08850"
                    data-node-id="I2521:42747;1226:17;1224:5905"
                    data-name="Avatar"
                  >
                    <p
                      className="admin-element-62ba4538c"
                      data-node-id="I2521:42747;1226:17;1224:5905;19:1257"
                    >
                      BN
                    </p>
                  </div>
                  <div
                    className="admin-element-5d5d43aaf"
                    data-node-id="I2521:42747;1226:17;1224:5906"
                    data-name="Text and supporting text"
                  >
                    <p
                      className="admin-element-c07ca1908"
                      data-node-id="I2521:42747;1226:17;1224:5907"
                    >
                      Blessing Nwachukwu
                    </p>
                    <p
                      className="admin-element-3ddb9fc65"
                      data-node-id="I2521:42747;1226:17;1224:5908"
                    >
                      +234 817 662 9013
                    </p>
                  </div>
                </div>
              </div>
              <div
                className="admin-element-95773e0af"
                data-node-id="I2521:42747;1225:108377"
                data-name="Column"
              >
                <div
                  className="admin-element-d731f387c"
                  data-node-id="I2521:42747;1224:5575"
                  data-name="Table header cell"
                >
                  <div
                    className="admin-element-3536005f7"
                    data-node-id="I2521:42747;1224:5575;1224:4551"
                    data-name="Table header"
                  >
                    <p
                      className="admin-element-afdb1c62e"
                      data-node-id="I2521:42747;1224:5575;1224:4551;1221:106889"
                    >{`State & LGA`}</p>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:42747;1225:108335"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-c46571178"
                    data-node-id="I2521:42747;1225:108335;1223:41"
                  >
                    <p className="admin-element-71f637913">Ebonyi</p>
                    <p className="admin-element-76aad9ca0">Abakaliki LGA</p>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:42747;1227:122229"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-c46571178"
                    data-node-id="I2521:42747;1227:122229;1223:41"
                  >
                    <p className="admin-element-71f637913">Kano</p>
                    <p className="admin-element-76aad9ca0">Kura LGA</p>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:42747;1227:122235"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-c46571178"
                    data-node-id="I2521:42747;1227:122235;1223:41"
                  >
                    <p className="admin-element-71f637913">Enugu</p>
                    <p className="admin-element-76aad9ca0">Nsukka LGA</p>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:42747;1227:122241"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-c46571178"
                    data-node-id="I2521:42747;1227:122241;1223:41"
                  >
                    <p className="admin-element-71f637913">Kaduna</p>
                    <p className="admin-element-76aad9ca0">Zaria LGA</p>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:42747;1227:122247"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-c46571178"
                    data-node-id="I2521:42747;1227:122247;1223:41"
                  >
                    <p className="admin-element-71f637913">Imo</p>
                    <p className="admin-element-76aad9ca0">Owerri West</p>
                  </div>
                </div>
              </div>
              <div
                className="admin-element-95773e0af"
                data-node-id="I2521:42747;1225:108378"
                data-name="Column"
              >
                <div
                  className="admin-element-d731f387c"
                  data-node-id="I2521:42747;1224:5797"
                  data-name="Table header cell"
                >
                  <div
                    className="admin-element-3536005f7"
                    data-node-id="I2521:42747;1224:5797;1224:4551"
                    data-name="Table header"
                  >
                    <p
                      className="admin-element-afdb1c62e"
                      data-node-id="I2521:42747;1224:5797;1224:4551;1221:106790"
                    >
                      Produce type
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:42747;1225:108336"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-c46571178"
                    data-node-id="I2521:42747;1225:108336;1223:41"
                  >
                    <p className="admin-element-71f637913">Roma Tomatoes</p>
                    <p className="admin-element-76aad9ca0">White Yams</p>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:42747;1225:108402"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-3a796eb24"
                    data-node-id="I2521:42747;1225:108402;1223:41"
                  >
                    Plum Tomatoes
                  </p>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:42747;1226:164"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-c46571178"
                    data-node-id="I2521:42747;1226:164;1223:41"
                  >
                    <p className="admin-element-71f637913">Yellow Garri</p>
                    <p className="admin-element-76aad9ca0">(Ijebu Grade)</p>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:42747;1226:166"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-c46571178"
                    data-node-id="I2521:42747;1226:166;1223:41"
                  >
                    <p className="admin-element-71f637913">Bell Peppers</p>
                    <p className="admin-element-76aad9ca0">Onions</p>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:42747;1226:168"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-c46571178"
                    data-node-id="I2521:42747;1226:168;1223:41"
                  >
                    <p className="admin-element-71f637913">Plantains</p>
                    <p className="admin-element-76aad9ca0">Palm Oil</p>
                  </div>
                </div>
              </div>
              <div
                className="admin-element-95773e0af"
                data-node-id="I2521:42747;1225:108385"
                data-name="Column"
              >
                <div
                  className="admin-element-d731f387c"
                  data-node-id="I2521:42747;1224:5800"
                  data-name="Table header cell"
                >
                  <div
                    className="admin-element-e8210ba62"
                    data-node-id="I2521:42747;1224:5800;1224:4551"
                    data-name="Table header"
                  >
                    <p
                      className="admin-element-afdb1c62e"
                      data-node-id="I2521:42747;1224:5800;1224:4551;1221:106781"
                    >
                      Submitted
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:42747;1225:108337"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-c46571178"
                    data-node-id="I2521:42747;1225:108337;1223:41"
                  >
                    <p className="admin-element-71f637913">Today,</p>
                    <p className="admin-element-71f637913">08:45 AM</p>
                    <p className="admin-element-76aad9ca0">32m ago</p>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:42747;1225:108404"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-c46571178"
                    data-node-id="I2521:42747;1225:108404;1223:41"
                  >
                    <p className="admin-element-71f637913">Today,</p>
                    <p className="admin-element-71f637913">07:15 AM</p>
                    <p className="admin-element-76aad9ca0">2h 02m ago</p>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:42747;1226:188"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-c46571178"
                    data-node-id="I2521:42747;1226:188;1223:41"
                  >
                    <p className="admin-element-71f637913">Yesterday,</p>
                    <p className="admin-element-71f637913">18:20</p>
                    <p className="admin-element-76aad9ca0">14h ago</p>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:42747;1226:190"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-c46571178"
                    data-node-id="I2521:42747;1226:190;1223:41"
                  >
                    <p className="admin-element-71f637913">Yesterday,</p>
                    <p className="admin-element-71f637913">16:04</p>
                    <p className="admin-element-76aad9ca0">16h ago</p>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:42747;1226:192"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-46ea0ea0b"
                    data-node-id="I2521:42747;1226:192;1223:41"
                  >
                    <p className="admin-element-71f637913">Yesterday,</p>
                    <p className="admin-element-71f637913">14:10</p>
                    <p className="admin-element-76aad9ca0">18h ago (SLA Warning)</p>
                  </div>
                </div>
              </div>
              <div
                className="admin-element-95773e0af"
                data-node-id="I2521:42747;1225:108386"
                data-name="Column"
              >
                <div
                  className="admin-element-d731f387c"
                  data-node-id="I2521:42747;1224:5850"
                  data-name="Table header cell"
                >
                  <div
                    className="admin-element-e8210ba62"
                    data-node-id="I2521:42747;1224:5850;1224:4551"
                    data-name="Table header"
                  >
                    <p
                      className="admin-element-afdb1c62e"
                      data-node-id="I2521:42747;1224:5850;1224:4551;1221:106781"
                    >
                      Documents
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:42747;1225:108338"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-c46571178"
                    data-node-id="I2521:42747;1225:108338;1223:41"
                  >
                    <p className="admin-element-71f637913">Voter’s Card</p>
                    <p className="admin-element-76aad9ca0">+ Selfie</p>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:42747;1226:216"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-3a796eb24"
                    data-node-id="I2521:42747;1226:216;1223:41"
                  >
                    National NIN Slip
                  </p>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:42747;1226:232"
                  data-name="Table cell"
                >
                  <div
                    className="admin-element-c46571178"
                    data-node-id="I2521:42747;1226:232;1223:41"
                  >
                    <p className="admin-element-71f637913">Driver License</p>
                    <p className="admin-element-76aad9ca0">+ Selfie</p>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:42747;1226:248"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-3a796eb24"
                    data-node-id="I2521:42747;1226:248;1223:41"
                  >
                    Voter’s Card
                  </p>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:42747;1226:264"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-f97866013"
                    data-node-id="I2521:42747;1226:264;1223:41"
                  >
                    △ Blurry Photo ID
                  </p>
                </div>
              </div>
              <div
                className="admin-element-95773e0af"
                data-node-id="I2521:42747;1227:112660"
                data-name="Column"
              >
                <div
                  className="admin-element-d731f387c"
                  data-node-id="I2521:42747;1227:112661"
                  data-name="Table header cell"
                >
                  <div
                    className="admin-element-e8210ba62"
                    data-node-id="I2521:42747;1227:112661;1224:4551"
                    data-name="Table header"
                  >
                    <p
                      className="admin-element-afdb1c62e"
                      data-node-id="I2521:42747;1227:112661;1224:4551;1221:106781"
                    >
                      Status
                    </p>
                  </div>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:42747;1227:112663"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-f1972ec70"
                    data-node-id="I2521:42747;1227:112663;1223:41"
                  >
                    ● ID waiting
                  </p>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:42747;1227:112665"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-f1972ec70"
                    data-node-id="I2521:42747;1227:112665;1223:41"
                  >
                    ● ID waiting
                  </p>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:42747;1227:112667"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-90224c663"
                    data-node-id="I2521:42747;1227:112667;1223:41"
                  >
                    ● Selfie review
                  </p>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:42747;1227:112669"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-f1972ec70"
                    data-node-id="I2521:42747;1227:112669;1223:41"
                  >
                    ● ID waiting
                  </p>
                </div>
                <div
                  className="admin-element-07f0df8c3"
                  data-node-id="I2521:42747;1227:112671"
                  data-name="Table cell"
                >
                  <p
                    className="admin-element-60fcc949c"
                    data-node-id="I2521:42747;1227:112671;1223:41"
                  >
                    ● Flagged
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div
            className="admin-element-47a6d5635"
            data-node-id="2521:42748"
            data-name="Queue pagination"
          >
            <p className="admin-element-20d1cfadc" data-node-id="2521:42749">
              Showing 1–5 of 14 farmers • Page 1 of 3
            </p>
            <div
              className="admin-element-34d33d007"
              data-node-id="2521:42750"
              data-name="Status badge"
            >
              <div
                className="admin-element-45367f628"
                data-node-id="I2521:42750;1046:4838"
                data-name="_Badge base"
              >
                <p className="admin-element-7222d49ee" data-node-id="I2521:42750;1046:4838;1046:26">
                  ‹ Previous
                </p>
              </div>
            </div>
            <div
              className="admin-element-34d33d007"
              data-node-id="2521:42751"
              data-name="Status badge"
            >
              <div
                className="admin-element-f9034e18a"
                data-node-id="I2521:42751;1046:4838"
                data-name="_Badge base"
              >
                <p className="admin-element-157c991da" data-node-id="I2521:42751;1046:4838;1046:26">
                  1
                </p>
              </div>
            </div>
            <div
              className="admin-element-34d33d007"
              data-node-id="2521:42752"
              data-name="Status badge"
            >
              <div
                className="admin-element-45367f628"
                data-node-id="I2521:42752;1046:4838"
                data-name="_Badge base"
              >
                <p className="admin-element-7222d49ee" data-node-id="I2521:42752;1046:4838;1046:26">
                  2
                </p>
              </div>
            </div>
            <div
              className="admin-element-34d33d007"
              data-node-id="2521:42753"
              data-name="Status badge"
            >
              <div
                className="admin-element-45367f628"
                data-node-id="I2521:42753;1046:4838"
                data-name="_Badge base"
              >
                <p className="admin-element-7222d49ee" data-node-id="I2521:42753;1046:4838;1046:26">
                  3
                </p>
              </div>
            </div>
            <div
              className="admin-element-34d33d007"
              data-node-id="2521:42754"
              data-name="Status badge"
            >
              <div
                className="admin-element-45367f628"
                data-node-id="I2521:42754;1046:4838"
                data-name="_Badge base"
              >
                <p className="admin-element-7222d49ee" data-node-id="I2521:42754;1046:4838;1046:26">
                  Next ›
                </p>
              </div>
            </div>
          </div>
        </div>
        <div
          className="admin-element-87601b9de"
          data-node-id="2521:42755"
          data-name="Queue supporting panels"
        >
          <div
            className="admin-element-f57dd3607"
            data-node-id="2521:42756"
            data-name="Queue distribution"
          >
            <p className="admin-element-e90437edd" data-node-id="2521:42757">
              Queue Distribution
            </p>
            <div
              className="admin-element-a7f65761d"
              data-node-id="2521:42758"
              data-name="Queue breakdown"
            >
              <div
                className="admin-element-30defc1c3"
                data-node-id="2521:42759"
                data-name="Donut chart"
              >
                <p className="admin-element-4d74b77dc" data-node-id="2521:42760">
                  14
                </p>
                <div
                  className="admin-element-0bb5547f9"
                  data-node-id="2521:42761"
                  data-name="Review segment"
                >
                  <div className="admin-element-fafb23639">
                    <img alt="" className="admin-element-acc3667e9" src={imgReviewSegment} />
                  </div>
                </div>
                <div
                  className="admin-element-0bb5547f9"
                  data-node-id="2521:42762"
                  data-name="Flagged segment"
                >
                  <div className="admin-element-c63430288">
                    <img alt="" className="admin-element-acc3667e9" src={imgFlaggedSegment} />
                  </div>
                </div>
                <div
                  className="admin-element-0bb5547f9"
                  data-node-id="2521:42763"
                  data-name="Waiting segment"
                >
                  <div className="admin-element-5c5a81280">
                    <img alt="" className="admin-element-acc3667e9" src={imgWaitingSegment} />
                  </div>
                </div>
              </div>
              <div className="admin-element-44344dc77" data-node-id="2521:42764">
                <p className="admin-element-96eff31b5">● ID Waiting (57%)</p>
                <p className="admin-element-96eff31b5">● Flagged / Blur (21%)</p>
                <p className="admin-element-a4d2b1ada">● Selfie In Review (22%)</p>
              </div>
            </div>
          </div>
          <div
            className="admin-element-f57dd3607"
            data-node-id="2521:42765"
            data-name="LGA field marshals"
          >
            <div
              className="admin-element-4a6cc29e3"
              data-node-id="2521:42766"
              data-name="Field marshals heading"
            >
              <p className="admin-element-60fd88bb2" data-node-id="2521:42767">
                LGA Field Marshals
              </p>
              <div
                className="admin-element-34d33d007"
                data-node-id="2521:42768"
                data-name="Status badge"
              >
                <div
                  className="admin-element-f9034e18a"
                  data-node-id="I2521:42768;1046:4838"
                  data-name="_Badge base"
                >
                  <p
                    className="admin-element-157c991da"
                    data-node-id="I2521:42768;1046:4838;1046:26"
                  >
                    4 Active
                  </p>
                </div>
              </div>
            </div>
            <p
              className="admin-element-82438c881"
              data-node-id="2521:42769"
            >{`Mobile field marshals in Kano & Ebonyi are currently confirming farm land boundaries via GPS.`}</p>
            <p
              className="admin-element-549b2c816"
              data-node-id="2521:42770"
            >{`Abakaliki Depot active   Sync 4m ago`}</p>
          </div>
          <div
            className="admin-element-cfb738f6d"
            data-node-id="2521:42771"
            data-name="Fast-track batch"
          >
            <p className="admin-element-46d159df0" data-node-id="2521:42772">
              Fast-Track Batch ⚡
            </p>
            <p className="admin-element-81436e9d0" data-node-id="2521:42773">
              Tomato harvest window in Kano requires rapid onboarding for 4 registered growers
              before 12:00 PM.
            </p>
            <AdminControl
              className="admin-element-aa1ba3e9d"
              data-node-id="2521:42774"
              data-name="Priority batch action"
            >
              <p className="admin-element-a53099d55" data-node-id="2521:42775">
                Process Priority Batch (4)
              </p>
            </AdminControl>
          </div>
        </div>
      </div>
    </div>
  );
}
