import Link from "next/link";
import { AdminControl, AdminField } from "../controls";
const assetPathPrefix = "/admin-assets";
const imgMapPin = `${assetPathPrefix}/9ed31.svg`;
const imgJiraOps = `${assetPathPrefix}/3288b.svg`;
const imgFreebsd = `${assetPathPrefix}/37f07.svg`;
const imgStickerCircle = `${assetPathPrefix}/3b95a.svg`;
const imgTextInput = `${assetPathPrefix}/f8c2f.svg`;
const imgDroplet = `${assetPathPrefix}/c6bcf.svg`;
const imgApprovedLeetlogicIcon = `${assetPathPrefix}/a5a13.svg`;
const imgLayoutGrid01 = `${assetPathPrefix}/4d120.svg`;
const imgCheckVerified03 = `${assetPathPrefix}/bbad0.svg`;
const imgArchive = `${assetPathPrefix}/22c79.svg`;
const imgTruck = `${assetPathPrefix}/aac1c.svg`;
const imgBarChart10 = `${assetPathPrefix}/b0474.svg`;
const imgHeadphones01 = `${assetPathPrefix}/2fa33.svg`;
const imgSliders04 = `${assetPathPrefix}/6c589.svg`;
const imgLogOut = `${assetPathPrefix}/f23bc.svg`;
const imgSearch = `${assetPathPrefix}/ef75b.svg`;
const imgBell = `${assetPathPrefix}/182b5.svg`;
const imgUserCircle = `${assetPathPrefix}/8d4b4.svg`;
const imgChevronDown = `${assetPathPrefix}/a811f.svg`;
const imgDownload = `${assetPathPrefix}/6c69b.svg`;
const imgBarChart11 = `${assetPathPrefix}/efa35.svg`;
const imgChevronRight = `${assetPathPrefix}/b08e9.svg`;
const imgArrowRight = `${assetPathPrefix}/7f104.svg`;
type LeetlogicIOsDispatchCardProps = {
  className?: string;
  children?: React.ReactNode | null;
  status?: "Completed" | "In transit" | "Customs clear" | "Documentation";
};
function LeetlogicIOsDispatchCard({
  className,
  children = null,
  status = "Completed",
}: LeetlogicIOsDispatchCardProps) {
  const isCustomsClear = status === "Customs clear";
  const isDocumentation = status === "Documentation";
  const isInTransit = status === "In transit";
  return (
    <div
      className={className || "admin-element-a1d6b45b4"}
      id={
        isDocumentation
          ? "node-2521_21426"
          : isCustomsClear
            ? "node-2521_21416"
            : isInTransit
              ? "node-2521_21406"
              : "node-2521_21396"
      }
    >
      {status === "Completed" && (
        <div className="admin-element-ab2e57bf6" data-node-id="2521:21397" data-name="Content">
          {children || (
            <>
              <div
                className="admin-element-a14631f11"
                data-node-id="2521:21398"
                data-name="Dispatch identity"
              >
                <p
                  className="admin-element-ba6c094ce"
                  data-node-id="2521:21399"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  #EXP-092
                </p>
                <div
                  className="admin-element-311e6f066"
                  data-node-id="2521:21400"
                  data-name="Status badge"
                >
                  <p
                    className="admin-element-85a843bee"
                    data-node-id="2521:21401"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    COMPLETED
                  </p>
                </div>
              </div>
              <div
                className="admin-element-96f7aef84"
                data-node-id="2521:21402"
                data-name="Destination"
              >
                <div
                  className="admin-element-c51752dc8"
                  data-node-id="2521:21403"
                  data-name="map-pin"
                >
                  <img alt="" className="admin-element-8faf267d3" src={imgMapPin} />
                </div>
                <p
                  className="admin-element-b109a6467"
                  data-node-id="2521:21404"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  London, UK
                </p>
              </div>
              <p
                className="admin-element-49486ebf3"
                data-node-id="2521:21405"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Red Palm Oil (500L) · Verified Heathrow Air Freight
              </p>
            </>
          )}
        </div>
      )}
      {isInTransit && (
        <div className="admin-element-ab2e57bf6" data-node-id="2521:21407" data-name="Content">
          {children || (
            <>
              <div
                className="admin-element-a14631f11"
                data-node-id="2521:21408"
                data-name="Dispatch identity"
              >
                <p
                  className="admin-element-ba6c094ce"
                  data-node-id="2521:21409"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  #EXP-094
                </p>
                <div
                  className="admin-element-392f38cb7"
                  data-node-id="2521:21410"
                  data-name="Status badge"
                >
                  <p
                    className="admin-element-678703016"
                    data-node-id="2521:21411"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    IN TRANSIT
                  </p>
                </div>
              </div>
              <div
                className="admin-element-96f7aef84"
                data-node-id="2521:21412"
                data-name="Destination"
              >
                <div
                  className="admin-element-c51752dc8"
                  data-node-id="2521:21413"
                  data-name="map-pin"
                >
                  <img alt="" className="admin-element-8faf267d3" src={imgMapPin} />
                </div>
                <p
                  className="admin-element-b109a6467"
                  data-node-id="2521:21414"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Accra, Ghana
                </p>
              </div>
              <p
                className="admin-element-49486ebf3"
                data-node-id="2521:21415"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Dried White Garri (1,200kg) · Seme Border Intermodal
              </p>
            </>
          )}
        </div>
      )}
      {isCustomsClear && (
        <div className="admin-element-ab2e57bf6" data-node-id="2521:21417" data-name="Content">
          {children || (
            <>
              <div
                className="admin-element-a14631f11"
                data-node-id="2521:21418"
                data-name="Dispatch identity"
              >
                <p
                  className="admin-element-ba6c094ce"
                  data-node-id="2521:21419"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  #EXP-097
                </p>
                <div
                  className="admin-element-311e6f066"
                  data-node-id="2521:21420"
                  data-name="Status badge"
                >
                  <p
                    className="admin-element-85a843bee"
                    data-node-id="2521:21421"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    CUSTOMS CLEAR
                  </p>
                </div>
              </div>
              <div
                className="admin-element-96f7aef84"
                data-node-id="2521:21422"
                data-name="Destination"
              >
                <div
                  className="admin-element-c51752dc8"
                  data-node-id="2521:21423"
                  data-name="map-pin"
                >
                  <img alt="" className="admin-element-8faf267d3" src={imgMapPin} />
                </div>
                <p
                  className="admin-element-b109a6467"
                  data-node-id="2521:21424"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Dubai, UAE
                </p>
              </div>
              <p
                className="admin-element-49486ebf3"
                data-node-id="2521:21425"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >{`Dried Ginger & Pepper · Jebel Ali Quarantine Bay`}</p>
            </>
          )}
        </div>
      )}
      {isDocumentation && (
        <div className="admin-element-ab2e57bf6" data-node-id="2521:21427" data-name="Content">
          {children || (
            <>
              <div
                className="admin-element-a14631f11"
                data-node-id="2521:21428"
                data-name="Dispatch identity"
              >
                <p
                  className="admin-element-ba6c094ce"
                  data-node-id="2521:21429"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  #EXP-101
                </p>
                <div
                  className="admin-element-311e6f066"
                  data-node-id="2521:21430"
                  data-name="Status badge"
                >
                  <p
                    className="admin-element-85a843bee"
                    data-node-id="2521:21431"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    DOCUMENTATION
                  </p>
                </div>
              </div>
              <div
                className="admin-element-96f7aef84"
                data-node-id="2521:21432"
                data-name="Destination"
              >
                <div
                  className="admin-element-c51752dc8"
                  data-node-id="2521:21433"
                  data-name="map-pin"
                >
                  <img alt="" className="admin-element-8faf267d3" src={imgMapPin} />
                </div>
                <p
                  className="admin-element-b109a6467"
                  data-node-id="2521:21434"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Manchester, UK
                </p>
              </div>
              <p
                className="admin-element-49486ebf3"
                data-node-id="2521:21435"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Processed Cassava Chips · NAQS Phyto Cert Issued
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
function JiraOps({ className }: { className?: string }) {
  return (
    <div
      className={className || "admin-element-69a76d60a"}
      data-node-id="2470:4021"
      data-name="jira_ops"
    >
      <div className="admin-element-c9d20a6e9" data-node-id="2470:4022" data-name="jira_ops">
        <img alt="" className="admin-element-8faf267d3" src={imgJiraOps} />
      </div>
    </div>
  );
}
function Freebsd({ className }: { className?: string }) {
  return (
    <div
      className={className || "admin-element-738acb643"}
      data-node-id="2470:4013"
      data-name="freebsd"
    >
      <img alt="" className="admin-element-8faf267d3" src={imgFreebsd} />
    </div>
  );
}
type LeetlogicIOsCommodityRowProps = {
  className?: string;
  children?: React.ReactNode | null;
  produce?: "Tomatoes" | "Yams" | "Garri" | "Palm oil" | "Peppers";
};
function LeetlogicIOsCommodityRow({
  className,
  children = null,
  produce = "Tomatoes",
}: LeetlogicIOsCommodityRowProps) {
  const isGarri = produce === "Garri";
  const isPalmOil = produce === "Palm oil";
  const isPeppers = produce === "Peppers";
  const isYams = produce === "Yams";
  return (
    <div
      className={
        className ||
        `admin-element-5c6c295b2 ${isPalmOil ? "admin-element-896dce0f4" : "admin-element-1b398c3a5"}`
      }
      id={
        isPeppers
          ? "node-2521_21383"
          : isPalmOil
            ? "node-2521_21369"
            : isGarri
              ? "node-2521_21357"
              : isYams
                ? "node-2521_21345"
                : "node-2521_21333"
      }
    >
      {produce === "Tomatoes" && (
        <div className="admin-element-5d22e888d" data-node-id="2521:21334" data-name="Content">
          {children || (
            <>
              <div
                className="admin-element-25c62eec8"
                data-node-id="2521:21335"
                data-name="Commodity symbol"
              >
                <Freebsd className="admin-element-35368e319" />
              </div>
              <div
                className="admin-element-b25f2fb4e"
                data-node-id="2521:21337"
                data-name="Commodity content"
              >
                <p
                  className="admin-element-b07130151"
                  data-node-id="2521:21338"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Roma Tomatoes
                </p>
                <p
                  className="admin-element-9f0e00559"
                  data-node-id="2521:21339"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  14,250 kg harvested · 37% total volume
                </p>
              </div>
              <div
                className="admin-element-25b8c2e95"
                data-node-id="2521:21340"
                data-name="Commodity revenue"
              >
                <p
                  className="admin-element-383c6731b"
                  data-node-id="2521:21341"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  ₦6,800,000
                </p>
                <p
                  className="admin-element-302ec846c"
                  data-node-id="2521:21342"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  ₦477.19 / kg avg
                </p>
              </div>
              <div
                className="admin-element-f59e44889"
                data-node-id="2521:21343"
                data-name="Volume share"
              >
                <p
                  className="admin-element-ba6c094ce"
                  data-node-id="2521:21344"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  37%
                </p>
              </div>
            </>
          )}
        </div>
      )}
      {isYams && (
        <div className="admin-element-5d22e888d" data-node-id="2521:21346" data-name="Content">
          {children || (
            <>
              <div
                className="admin-element-877c1acf4"
                data-node-id="2521:21347"
                data-name="Commodity symbol"
              >
                <div
                  className="admin-element-35368e319"
                  data-node-id="2521:21348"
                  data-name="sticker-circle"
                >
                  <img alt="" className="admin-element-8faf267d3" src={imgStickerCircle} />
                </div>
              </div>
              <div
                className="admin-element-b25f2fb4e"
                data-node-id="2521:21349"
                data-name="Commodity content"
              >
                <p
                  className="admin-element-b07130151"
                  data-node-id="2521:21350"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  White Yams (Benue Tubers)
                </p>
                <p
                  className="admin-element-9f0e00559"
                  data-node-id="2521:21351"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  8,900 kg harvested · 22% total volume
                </p>
              </div>
              <div
                className="admin-element-25b8c2e95"
                data-node-id="2521:21352"
                data-name="Commodity revenue"
              >
                <p
                  className="admin-element-383c6731b"
                  data-node-id="2521:21353"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  ₦4,100,000
                </p>
                <p
                  className="admin-element-302ec846c"
                  data-node-id="2521:21354"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  ₦460.67 / kg avg
                </p>
              </div>
              <div
                className="admin-element-f59e44889"
                data-node-id="2521:21355"
                data-name="Volume share"
              >
                <p
                  className="admin-element-ba6c094ce"
                  data-node-id="2521:21356"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  22%
                </p>
              </div>
            </>
          )}
        </div>
      )}
      {isGarri && (
        <div className="admin-element-5d22e888d" data-node-id="2521:21358" data-name="Content">
          {children || (
            <>
              <div
                className="admin-element-f6c411b84"
                data-node-id="2521:21359"
                data-name="Commodity symbol"
              >
                <div
                  className="admin-element-35368e319"
                  data-node-id="2521:21360"
                  data-name="text-input"
                >
                  <img alt="" className="admin-element-8faf267d3" src={imgTextInput} />
                </div>
              </div>
              <div
                className="admin-element-b25f2fb4e"
                data-node-id="2521:21361"
                data-name="Commodity content"
              >
                <p
                  className="admin-element-b07130151"
                  data-node-id="2521:21362"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >{`Cassava & Ijebu Garri`}</p>
                <p
                  className="admin-element-9f0e00559"
                  data-node-id="2521:21363"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  11,200 kg processed · 19% total volume
                </p>
              </div>
              <div
                className="admin-element-25b8c2e95"
                data-node-id="2521:21364"
                data-name="Commodity revenue"
              >
                <p
                  className="admin-element-383c6731b"
                  data-node-id="2521:21365"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  ₦3,500,000
                </p>
                <p
                  className="admin-element-302ec846c"
                  data-node-id="2521:21366"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  ₦312.50 / kg avg
                </p>
              </div>
              <div
                className="admin-element-f59e44889"
                data-node-id="2521:21367"
                data-name="Volume share"
              >
                <p
                  className="admin-element-ba6c094ce"
                  data-node-id="2521:21368"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  19%
                </p>
              </div>
            </>
          )}
        </div>
      )}
      {isPalmOil && (
        <div className="admin-element-5d22e888d" data-node-id="2521:21370" data-name="Content">
          {children || (
            <>
              <div
                className="admin-element-ed8ee0ae6"
                data-node-id="2521:21371"
                data-name="Commodity symbol"
              >
                <div
                  className="admin-element-35368e319"
                  data-node-id="2521:21372"
                  data-name="droplet"
                >
                  <img alt="" className="admin-element-8faf267d3" src={imgDroplet} />
                </div>
              </div>
              <div
                className="admin-element-d3594aa9f"
                data-node-id="2521:21373"
                data-name="Commodity content"
              >
                <p
                  className="admin-element-567c85efb"
                  data-node-id="2521:21374"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Red Palm Oil (Grade A)
                </p>
                <p
                  className="admin-element-9a29b649b"
                  data-node-id="2521:21375"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  4,800 Litres · 14% total volume
                </p>
                <div
                  className="admin-element-311e6f066"
                  data-node-id="2521:21376"
                  data-name="Status badge"
                >
                  <p
                    className="admin-element-85a843bee"
                    data-node-id="2521:21377"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    EXPORT ENABLED
                  </p>
                </div>
              </div>
              <div
                className="admin-element-25b8c2e95"
                data-node-id="2521:21378"
                data-name="Commodity revenue"
              >
                <p
                  className="admin-element-383c6731b"
                  data-node-id="2521:21379"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  ₦2,600,000
                </p>
                <p
                  className="admin-element-302ec846c"
                  data-node-id="2521:21380"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  ₦541.67 / L avg
                </p>
              </div>
              <div
                className="admin-element-f59e44889"
                data-node-id="2521:21381"
                data-name="Volume share"
              >
                <p
                  className="admin-element-ba6c094ce"
                  data-node-id="2521:21382"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  14%
                </p>
              </div>
            </>
          )}
        </div>
      )}
      {isPeppers && (
        <div className="admin-element-5d22e888d" data-node-id="2521:21384" data-name="Content">
          {children || (
            <>
              <div
                className="admin-element-25c62eec8"
                data-node-id="2521:21385"
                data-name="Commodity symbol"
              >
                <JiraOps className="admin-element-2ad4e235b" />
              </div>
              <div
                className="admin-element-b25f2fb4e"
                data-node-id="2521:21387"
                data-name="Commodity content"
              >
                <p
                  className="admin-element-b07130151"
                  data-node-id="2521:21388"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Hot Peppers (Ata Rodo)
                </p>
                <p
                  className="admin-element-9f0e00559"
                  data-node-id="2521:21389"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  2,100 kg harvested · 8% total volume
                </p>
              </div>
              <div
                className="admin-element-25b8c2e95"
                data-node-id="2521:21390"
                data-name="Commodity revenue"
              >
                <p
                  className="admin-element-383c6731b"
                  data-node-id="2521:21391"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  ₦1,420,000
                </p>
                <p
                  className="admin-element-302ec846c"
                  data-node-id="2521:21392"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  ₦676.19 / kg avg
                </p>
              </div>
              <div
                className="admin-element-f59e44889"
                data-node-id="2521:21393"
                data-name="Volume share"
              >
                <p
                  className="admin-element-ba6c094ce"
                  data-node-id="2521:21394"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  8%
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
type LeetlogicIOsReportMetricCardProps = {
  className?: string;
  children?: React.ReactNode | null;
  metric?: "Sales" | "International" | "Top crop" | "Settlement";
};
function LeetlogicIOsReportMetricCard({
  className,
  children = null,
  metric = "Sales",
}: LeetlogicIOsReportMetricCardProps) {
  const isInternational = metric === "International";
  const isSettlement = metric === "Settlement";
  const isTopCrop = metric === "Top crop";
  return (
    <div
      className={
        className ||
        `admin-element-79d2a9abd ${["International", "Top crop", "Settlement"].includes(metric) ? "" : "admin-element-71b13d74c"}`
      }
      id={
        isSettlement
          ? "node-2521_21323"
          : isTopCrop
            ? "node-2521_21313"
            : isInternational
              ? "node-2521_21302"
              : "node-2521_21292"
      }
    >
      {metric === "Sales" && (
        <div className="admin-element-0224c244e" data-node-id="2521:21293" data-name="Content">
          {children || (
            <>
              <div
                className="admin-element-57cd0aef2"
                data-node-id="2521:21294"
                data-name="Metric label"
              >
                <p
                  className="admin-element-57afd4192"
                  data-node-id="2521:21295"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  SALES THIS MONTH
                </p>
                <div
                  className="admin-element-311e6f066"
                  data-node-id="2521:21296"
                  data-name="Status badge"
                >
                  <p
                    className="admin-element-85a843bee"
                    data-node-id="2521:21297"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    ↑ +22.4%
                  </p>
                </div>
              </div>
              <p
                className="admin-element-a844033ef"
                data-node-id="2521:21298"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                ₦18,420,000
              </p>
              <p
                className="admin-element-a44744795"
                data-node-id="2521:21299"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Gross Merchandise Volume across 18 states
              </p>
              <div
                className="admin-element-f39f57b50"
                data-node-id="2521:21300"
                data-name="Sales progress"
              >
                <div
                  className="admin-element-3f851ecee"
                  data-node-id="2521:21301"
                  data-name="Progress"
                />
              </div>
            </>
          )}
        </div>
      )}
      {isInternational && (
        <div className="admin-element-0224c244e" data-node-id="2521:21303" data-name="Content">
          {children || (
            <>
              <div
                className="admin-element-57cd0aef2"
                data-node-id="2521:21304"
                data-name="Metric label"
              >
                <p
                  className="admin-element-57afd4192"
                  data-node-id="2521:21305"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  INTERNATIONAL ORDERS
                </p>
                <div
                  className="admin-element-392f38cb7"
                  data-node-id="2521:21306"
                  data-name="Status badge"
                >
                  <p
                    className="admin-element-678703016"
                    data-node-id="2521:21307"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Active Corridors
                  </p>
                </div>
              </div>
              <div
                className="admin-element-eaf1d18b1"
                data-node-id="2521:21308"
                data-name="Order value"
              >
                <p
                  className="admin-element-08671e48f"
                  data-node-id="2521:21309"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  4
                </p>
                <p
                  className="admin-element-147b39cab"
                  data-node-id="2521:21310"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Consignments
                </p>
              </div>
              <p
                className="admin-element-aaa436472"
                data-node-id="2521:21311"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >{`UK (2), UAE (1), Ghana (1) · Dried goods & palm oil`}</p>
              <p
                className="admin-element-a44e479fa"
                data-node-id="2521:21312"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                100% On-time Customs cleared
              </p>
            </>
          )}
        </div>
      )}
      {isTopCrop && (
        <div className="admin-element-0224c244e" data-node-id="2521:21314" data-name="Content">
          {children || (
            <>
              <div
                className="admin-element-f0bcf4b82"
                data-node-id="2521:21315"
                data-name="Metric label"
              >
                <p
                  className="admin-element-0011b0bee"
                  data-node-id="2521:21316"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  TOP CROP
                </p>
                <div
                  className="admin-element-311e6f066"
                  data-node-id="2521:21317"
                  data-name="Status badge"
                >
                  <p
                    className="admin-element-85a843bee"
                    data-node-id="2521:21318"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    High Yield
                  </p>
                </div>
              </div>
              <p className="admin-element-f6b7edd74" data-node-id="2521:21319">
                Roma Tomatoes
              </p>
              <p
                className="admin-element-eec7c9627"
                data-node-id="2521:21320"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                14,250 kg (₦6.8m)
              </p>
              <p
                className="admin-element-aaa436472"
                data-node-id="2521:21321"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >{`Ebonyi & Kano supply routes`}</p>
              <p
                className="admin-element-49486ebf3"
                data-node-id="2521:21322"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                94% cold-chain compliance
              </p>
            </>
          )}
        </div>
      )}
      {isSettlement && (
        <div className="admin-element-0224c244e" data-node-id="2521:21324" data-name="Content">
          {children || (
            <>
              <div
                className="admin-element-57cd0aef2"
                data-node-id="2521:21325"
                data-name="Metric label"
              >
                <p
                  className="admin-element-57afd4192"
                  data-node-id="2521:21326"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  ESCROW SETTLEMENT RATE
                </p>
                <div
                  className="admin-element-311e6f066"
                  data-node-id="2521:21327"
                  data-name="Status badge"
                >
                  <p
                    className="admin-element-85a843bee"
                    data-node-id="2521:21328"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Safe Lock
                  </p>
                </div>
              </div>
              <p
                className="admin-element-548fdd315"
                data-node-id="2521:21329"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                99.4%
              </p>
              <p
                className="admin-element-a44744795"
                data-node-id="2521:21330"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Average payout speed: 2.4h post-delivery
              </p>
              <p
                className="admin-element-dd0e46af3"
                data-node-id="2521:21331"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                Zero unresolved collateral holds
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
export default function Component2501OperationalReportsAnalyticsOctober2024() {
  return (
    <div
      className="admin-element-ed8971f7b"
      data-node-id="2521:45096"
      data-name="25.01 · Operational reports & analytics — October 2024"
    >
      <div
        className="admin-element-f962b5f09"
        data-node-id="2521:45097"
        data-name="Operations sidebar"
      >
        <div className="admin-element-c427675f0" data-node-id="2521:45098" data-name="Brand">
          <div
            className="admin-element-a6f8c7bf2"
            data-node-id="2521:45099"
            data-name="Approved Leetlogic icon"
          >
            <img alt="" className="admin-element-8faf267d3" src={imgApprovedLeetlogicIcon} />
          </div>
          <p className="admin-element-7a3ef0008" data-node-id="2521:45102">
            Leetlogic
          </p>
          <div
            className="admin-element-311e6f066"
            data-node-id="2521:45103"
            data-name="Status badge"
          >
            <p
              className="admin-element-85a843bee"
              data-node-id="2521:45104"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              OPS
            </p>
          </div>
        </div>
        <div
          className="admin-element-7b245c1b6"
          data-node-id="2521:45105"
          data-name="Staff identity"
        >
          <div
            className="admin-element-d02ee07c4"
            data-node-id="2521:45106"
            data-name="Staff avatar"
          >
            <p
              className="admin-element-139a78ed1"
              data-node-id="2521:45107"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              A
            </p>
          </div>
          <div
            className="admin-element-f465b944c"
            data-node-id="2521:45108"
            data-name="Staff details"
          >
            <p
              className="admin-element-7c93ccacc"
              data-node-id="2521:45109"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              Amaka
            </p>
            <p
              className="admin-element-2f1567481"
              data-node-id="2521:45110"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              Operations Admin
            </p>
          </div>
          <div
            className="admin-element-a7afba6ba"
            data-node-id="2521:45111"
            data-name="Online indicator"
          />
        </div>
        <div
          className="admin-element-c94ed62b9"
          data-node-id="2521:45112"
          data-name="Workspace navigation"
        >
          <div
            className="admin-element-e29ec57a9"
            data-node-id="2521:45113"
            data-name="Navigation item"
          >
            <div
              className="admin-element-35368e319"
              data-node-id="2521:45114"
              data-name="layout-grid-01"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgLayoutGrid01} />
            </div>
            <Link
              className="admin-element-85664edec"
              data-node-id="2521:45115"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/dashboard"
            >
              Dashboard
            </Link>
          </div>
          <div
            className="admin-element-e29ec57a9"
            data-node-id="2521:45116"
            data-name="Navigation item"
          >
            <div
              className="admin-element-35368e319"
              data-node-id="2521:45117"
              data-name="check-verified-03"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgCheckVerified03} />
            </div>
            <Link
              className="admin-element-85664edec"
              data-node-id="2521:45118"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/verification"
            >
              Verification Queue
            </Link>
          </div>
          <div
            className="admin-element-e29ec57a9"
            data-node-id="2521:45119"
            data-name="Navigation item"
          >
            <div className="admin-element-35368e319" data-node-id="2521:45120" data-name="archive">
              <img alt="" className="admin-element-8faf267d3" src={imgArchive} />
            </div>
            <Link
              className="admin-element-85664edec"
              data-node-id="2521:45121"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/listings"
            >
              Listings
            </Link>
          </div>
          <Link
            className="admin-element-e29ec57a9"
            data-node-id="2521:45122"
            data-name="Navigation item"
            href="/admin/orders"
          >
            <div className="admin-element-35368e319" data-node-id="2521:45123" data-name="truck">
              <img alt="" className="admin-element-8faf267d3" src={imgTruck} />
            </div>
            <span
              className="admin-element-85664edec"
              data-node-id="2521:45124"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              Orders
            </span>
          </Link>
          <div
            className="admin-element-c7f95f022"
            data-node-id="2521:45125"
            data-name="Navigation item"
          >
            <div
              className="admin-element-35368e319"
              data-node-id="2521:45126"
              data-name="bar-chart-10"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgBarChart10} />
            </div>
            <Link
              className="admin-element-94c0111e3"
              data-node-id="2521:45127"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              href="/admin/reports"
            >
              Reports
            </Link>
          </div>
          <Link
            className="admin-element-e29ec57a9"
            data-node-id="2521:45128"
            data-name="Navigation item"
            href="/admin/disputes"
          >
            <div
              className="admin-element-35368e319"
              data-node-id="2521:45129"
              data-name="headphones-01"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgHeadphones01} />
            </div>
            <span
              className="admin-element-85664edec"
              data-node-id="2521:45130"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >{`Disputes & Support`}</span>
          </Link>
          <Link
            className="admin-element-e29ec57a9"
            data-node-id="2521:45131"
            data-name="Navigation item"
            href="/admin/settings"
          >
            <div
              className="admin-element-35368e319"
              data-node-id="2521:45132"
              data-name="sliders-04"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgSliders04} />
            </div>
            <span
              className="admin-element-85664edec"
              data-node-id="2521:45133"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              Admin Settings
            </span>
          </Link>
        </div>
        <div
          className="admin-element-10552d736"
          data-node-id="2521:45134"
          data-name="Sidebar spacer"
        />
        <div className="admin-element-41447df6e" data-node-id="2521:45135" data-name="Log out">
          <div className="admin-element-35368e319" data-node-id="2521:45136" data-name="log-out">
            <img alt="" className="admin-element-8faf267d3" src={imgLogOut} />
          </div>
          <Link
            className="admin-element-85664edec"
            data-node-id="2521:45137"
            style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            href="/admin/login"
          >
            Log Out
          </Link>
        </div>
      </div>
      <div
        className="admin-element-2415aa468"
        data-node-id="2521:45138"
        data-name="Operations workspace"
      >
        <div className="admin-element-884c19e75" data-node-id="2521:45139" data-name="Top bar">
          <div
            className="admin-element-2858c9fd8"
            data-node-id="2521:45140"
            data-name="Workspace search"
          >
            <div className="admin-element-35368e319" data-node-id="2521:45141" data-name="search">
              <img alt="" className="admin-element-8faf267d3" src={imgSearch} />
            </div>
            <p
              className="admin-element-09d328839"
              data-node-id="2521:45142"
              style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
            >
              Search growers, batches, orders, or SKUs...
            </p>
          </div>
          <div
            className="admin-element-840149908"
            data-node-id="2521:45143"
            data-name="System and account"
          >
            <div
              className="admin-element-311e6f066"
              data-node-id="2521:45144"
              data-name="Status badge"
            >
              <p
                className="admin-element-85a843bee"
                data-node-id="2521:45145"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                • System Active · Lagos DC
              </p>
            </div>
            <div className="admin-element-35368e319" data-node-id="2521:45146" data-name="bell">
              <img alt="" className="admin-element-8faf267d3" src={imgBell} />
            </div>
            <div
              className="admin-element-35368e319"
              data-node-id="2521:45147"
              data-name="user-circle"
            >
              <img alt="" className="admin-element-8faf267d3" src={imgUserCircle} />
            </div>
          </div>
        </div>
        <div className="admin-element-a1e7e293e" data-node-id="2521:45148" data-name="Report body">
          <div
            className="admin-element-d1ad1b6de"
            data-node-id="2521:45149"
            data-name="Report header"
          >
            <div
              className="admin-element-0fc657b93"
              data-node-id="2521:45150"
              data-name="Report introduction"
            >
              <p
                className="admin-element-b3fa8514c"
                data-node-id="2521:45151"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >
                AUDIT LOG · NG-EXP-2024 / Consolidated View
              </p>
              <p
                className="admin-element-7c518ef91"
                data-node-id="2521:45152"
              >{`Operational Reports & Analytics`}</p>
              <p
                className="admin-element-5dbff57b7"
                data-node-id="2521:45153"
                style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
              >{`Financial summaries, harvest volume, and platform performance metrics for Nigeria & export corridors.`}</p>
            </div>
            <div
              className="admin-element-17a55068f"
              data-node-id="2521:45154"
              data-name="Report controls"
            >
              <div
                className="admin-element-58845eb6c"
                data-node-id="2521:45155"
                data-name="October reporting period"
              >
                <AdminField
                  className="admin-element-51368a6cd"
                  data-node-id="I2521:45155;1096:13994"
                  data-name="_Select input base"
                  initialValue="This Month (October 2024)"
                  label="Staff input"
                  select
                />
              </div>
              <div
                className="admin-element-597854f38"
                data-node-id="2521:45156"
                data-name="Export CSV"
              >
                <div
                  className="admin-element-35368e319"
                  data-node-id="2521:45157"
                  data-name="download"
                >
                  <img alt="" className="admin-element-8faf267d3" src={imgDownload} />
                </div>
                <p
                  className="admin-element-a1f858946"
                  data-node-id="2521:45158"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Export CSV
                </p>
              </div>
            </div>
          </div>
          <div
            className="admin-element-2336acf1f"
            data-node-id="2521:45159"
            data-name="Report metrics"
          >
            <LeetlogicIOsReportMetricCard className="admin-element-072636e97" />
            <LeetlogicIOsReportMetricCard
              className="admin-element-e1dd92e88"
              metric="International"
            />
            <LeetlogicIOsReportMetricCard className="admin-element-e1dd92e88" metric="Top crop" />
            <LeetlogicIOsReportMetricCard className="admin-element-e1dd92e88" metric="Settlement" />
          </div>
          <div
            className="admin-element-8bf62be33"
            data-node-id="2521:45164"
            data-name="Commodity and dispatch reports"
          >
            <div
              className="admin-element-18d0615ee"
              data-node-id="2521:45165"
              data-name="Monthly commodity breakdown"
            >
              <div
                className="admin-element-7757f91b3"
                data-node-id="2521:45166"
                data-name="Commodity heading"
              >
                <div
                  className="admin-element-84ada9385"
                  data-node-id="2521:45167"
                  data-name="Table introduction"
                >
                  <p className="admin-element-3c3005d5d" data-node-id="2521:45168">
                    Monthly Commodity Breakdown
                  </p>
                  <p
                    className="admin-element-4c1fa568e"
                    data-node-id="2521:45169"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >{`Harvest output & aggregated financial performance across domestic hubs`}</p>
                </div>
                <div
                  className="admin-element-a9f6273d4"
                  data-node-id="2521:45170"
                  data-name="Aggregate share"
                >
                  <p
                    className="admin-element-9a29b649b"
                    data-node-id="2521:45171"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    Aggregate Share:
                  </p>
                  <div
                    className="admin-element-311e6f066"
                    data-node-id="2521:45172"
                    data-name="Status badge"
                  >
                    <p
                      className="admin-element-85a843bee"
                      data-node-id="2521:45173"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      100% (₦18.42m)
                    </p>
                  </div>
                </div>
              </div>
              <div
                className="admin-element-a9db18b5c"
                data-node-id="2521:45174"
                data-name="Commodity distribution chart"
              >
                <div
                  className="admin-element-04bc73f88"
                  data-node-id="2521:45175"
                  data-name="Commodity share segment"
                />
                <div
                  className="admin-element-ce24f4d2f"
                  data-node-id="2521:45176"
                  data-name="Commodity share segment"
                />
                <div
                  className="admin-element-a046e0047"
                  data-node-id="2521:45177"
                  data-name="Commodity share segment"
                />
                <div
                  className="admin-element-c4cf51904"
                  data-node-id="2521:45178"
                  data-name="Commodity share segment"
                />
                <div
                  className="admin-element-95fa35b19"
                  data-node-id="2521:45179"
                  data-name="Commodity share segment"
                />
              </div>
              <div
                className="admin-element-5cc24a280"
                data-node-id="2521:45180"
                data-name="Commodity rows"
              >
                <LeetlogicIOsCommodityRow className="admin-element-8c10f534a" />
                <LeetlogicIOsCommodityRow className="admin-element-8c10f534a" produce="Yams" />
                <LeetlogicIOsCommodityRow className="admin-element-8c10f534a" produce="Garri" />
                <LeetlogicIOsCommodityRow className="admin-element-a971c34c1" produce="Palm oil" />
                <LeetlogicIOsCommodityRow className="admin-element-8c10f534a" produce="Peppers" />
              </div>
              <div
                className="admin-element-3836d7798"
                data-node-id="2521:45186"
                data-name="Commodity totals and ledger"
              >
                <div
                  className="admin-element-35368e319"
                  data-node-id="2521:45187"
                  data-name="bar-chart-10"
                >
                  <img alt="" className="admin-element-8faf267d3" src={imgBarChart11} />
                </div>
                <p
                  className="admin-element-b109a6467"
                  data-node-id="2521:45188"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Total Produce Mass Monitored: 41,250 kg / Domestic Fulfillment: 97.8%
                </p>
                <p
                  className="admin-element-d77016057"
                  data-node-id="2521:45189"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  View Full Ledger
                </p>
                <div
                  className="admin-element-35368e319"
                  data-node-id="2521:45190"
                  data-name="chevron-right"
                >
                  <img alt="" className="admin-element-8faf267d3" src={imgChevronRight} />
                </div>
              </div>
            </div>
            <div
              className="admin-element-e84e758b8"
              data-node-id="2521:45191"
              data-name="Export operations"
            >
              <div
                className="admin-element-78649e304"
                data-node-id="2521:45192"
                data-name="Recent dispatches"
              >
                <div
                  className="admin-element-3af50ae4b"
                  data-node-id="2521:45193"
                  data-name="Dispatch header"
                >
                  <p className="admin-element-17ad1734a" data-node-id="2521:45194">
                    Recent Dispatches
                  </p>
                  <div
                    className="admin-element-311e6f066"
                    data-node-id="2521:45195"
                    data-name="Status badge"
                  >
                    <p
                      className="admin-element-85a843bee"
                      data-node-id="2521:45196"
                      style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                    >
                      Cross-Border
                    </p>
                  </div>
                </div>
                <p
                  className="admin-element-aaa436472"
                  data-node-id="2521:45197"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  Real-time status for global consignments departing Nigerian hubs.
                </p>
                <LeetlogicIOsDispatchCard className="admin-element-aa46ba370" />
                <LeetlogicIOsDispatchCard className="admin-element-aa46ba370" status="In transit" />
                <LeetlogicIOsDispatchCard
                  className="admin-element-aa46ba370"
                  status="Customs clear"
                />
                <LeetlogicIOsDispatchCard
                  className="admin-element-aa46ba370"
                  status="Documentation"
                />
                <AdminControl
                  className="admin-element-f2c05119d"
                  data-node-id="2521:45202"
                  data-name="Export corridors action"
                >
                  <p
                    className="admin-element-0d925ce6f"
                    data-node-id="2521:45203"
                    style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                  >
                    View All Export Corridors
                  </p>
                  <div
                    className="admin-element-35368e319"
                    data-node-id="2521:45204"
                    data-name="arrow-right"
                  >
                    <img alt="" className="admin-element-8faf267d3" src={imgArrowRight} />
                  </div>
                </AdminControl>
              </div>
              <div
                className="admin-element-c4857abd4"
                data-node-id="2521:45205"
                data-name="Logistics assurance"
              >
                <p
                  className="admin-element-d2ae1fce9"
                  data-node-id="2521:45206"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  LOGISTICS ASSURANCE
                </p>
                <p
                  className="admin-element-c958aedf0"
                  data-node-id="2521:45207"
                >{`NAQS & NEPC Pre-Clearance`}</p>
                <p
                  className="admin-element-f51090a56"
                  data-node-id="2521:45208"
                  style={{ fontVariationSettings: '"CTGR" 0, "wdth" 100' }}
                >
                  All agricultural produce leaving Apapa or MMA cargo hubs maintains 100%
                  phyto-sanitary tracking with automated escrow release on proof of lading.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
