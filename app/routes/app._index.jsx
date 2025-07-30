import { useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  BlockStack,
  Text,
  Box,
  Select,
  InlineStack,
  TextField,
  Tooltip,
  Icon,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { ClipboardIcon } from "@shopify/polaris-icons";
import { useState, useRef } from "react";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const pageSize = parseInt(formData.get("pageSize")) || 10;
  const cursor = formData.get("cursor") || null;
  const direction = formData.get("direction") || "next";
  const page = parseInt(formData.get("page")) || 1;

  const query = `
    query GetProducts($cursor: String, $pageSize: Int!) {
      products(first: $pageSize, after: $cursor) {
        pageInfo {
          hasNextPage
          hasPreviousPage
          endCursor
          startCursor
        }
        nodes {
          id
          title
          onlineStoreUrl
        }
      }
    }
  `;

  const response = await admin.graphql(query, {
    variables: { cursor, pageSize },
  });

  const json = await response.json();
  const data = json.data.products;

  return {
    products: data.nodes,
    pageInfo: data.pageInfo,
    pageSize,
    currentPage: page,
  };
};

export default function ProductsPage() {
  const fetcher = useFetcher();
  const products = fetcher.data?.products || [];
  const pageInfo = fetcher.data?.pageInfo || {};
  const pageSize = fetcher.data?.pageSize || 10;
  const currentPage = fetcher.data?.currentPage || 1;

  const [targetPage, setTargetPage] = useState(currentPage);
  const preRef = useRef(null);

  const isFetching =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  const pageSizeOptions = [
    { label: "10", value: "10" },
    { label: "25", value: "25" },
    { label: "50", value: "50" },
    { label: "200", value: "200" },
  ];

  const submitForm = (options = {}) => {
    const form = new FormData();
    form.append("pageSize", options.pageSize ?? pageSize);
    form.append("page", String(options.page ?? currentPage));

    if (options.cursor) form.append("cursor", options.cursor);
    if (options.direction) form.append("direction", options.direction);

    fetcher.submit(form, { method: "POST" });
  };

  const handleNext = () => {
    submitForm({
      cursor: pageInfo.endCursor,
      direction: "next",
      page: currentPage + 1,
    });
  };

  const handlePrevious = () => {
    submitForm({
      cursor: pageInfo.startCursor,
      direction: "prev",
      page: currentPage - 1,
    });
  };

  const handleGoToPage = () => {
    submitForm({ page: targetPage });
  };

  const handleCopy = () => {
    if (preRef.current) {
      navigator.clipboard.writeText(preRef.current.textContent);
    }
  };

const formattedOutput = products
  .map((p) => {
    const id = p.id.replace("gid://shopify/Product/", "");
    const url = p.onlineStoreUrl || "";
    const title = (p.title || "").replace(/"/g, ""); // remove any quotes from title
    return `  {
    id: ${id},
    url: ${url},
    title: ${title}
  },`;
  })
  .join("\n");


  return (
    <Page>
      <TitleBar title="Paginated Products (CSV Style)" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack gap="300" align="start">
                  <Select
                    label="Products per page"
                    options={pageSizeOptions}
                    value={String(pageSize)}
                    onChange={(value) =>
                      submitForm({ pageSize: value, page: 1 })
                    }
                  />
                  <Button onClick={() => submitForm({})} loading={isFetching}>
                    Fetch Products
                  </Button>
                </InlineStack>

                {products.length > 0 && (
                  <>
                    <Text as="h3" variant="headingMd">
                      CSV View – Page {currentPage}
                    </Text>

                    <InlineStack gap="300" align="center">
                      <Button
                        onClick={handlePrevious}
                        disabled={!pageInfo.hasPreviousPage || currentPage <= 1}
                      >
                        Previous
                      </Button>
                      <Text variant="bodyMd">Page {currentPage}</Text>
                      <Button onClick={handleNext} disabled={!pageInfo.hasNextPage}>
                        Next
                      </Button>
                      <TextField
                        label="Go to page"
                        type="number"
                        min={1}
                        value={String(targetPage)}
                        onChange={(value) => setTargetPage(Number(value))}
                        autoComplete="off"
                      />
                      <Button onClick={handleGoToPage}>Go</Button>
                      <Tooltip content="Copy output">
                        <Button icon={ClipboardIcon} onClick={handleCopy} />
                      </Tooltip>
                    </InlineStack>

                    <Box
                      padding="400"
                      background="bg-surface-active"
                      borderWidth="025"
                      borderRadius="200"
                      borderColor="border"
                      maxHeight="400px"
                      overflowY="scroll"
                      fontFamily="monospace"
                      position="relative"
                    >
                      <pre ref={preRef} style={{ margin: 0 }}>
                        {`${formattedOutput
                          }`}
                      </pre>
                    </Box>
                  </>

                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
