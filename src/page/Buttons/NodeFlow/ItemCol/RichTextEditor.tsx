import React, {
  memo,
  useState,
  useEffect,
  useRef,
} from "react";
import { RichTextEditorContent } from "@lark-project/js-sdk";
import { RichTextEditor } from "@lark-project/ui-kit-plugin";
import sdk from "../../../../utils/sdk";

const RichTextEditorCom = memo(
  (props: {
    onChange: (value) => void;
    spaceId: string;
    data: any;
    index: number;
    cellIndex: number;
    workObjectId: string;
    workItemId: number;
    fieldKey: string;
  }) => {
    const { onChange, spaceId, data, workObjectId, workItemId, fieldKey } =
      props;
    const [doc, setDoc] = useState<RichTextEditorContent>({
      doc: "",
      is_empty: false,
    });
    const editorRef = useRef<any>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
      if (!visible) {
        if (editorRef.current?.setValue) {
          editorRef.current.setValue({ doc: "" });
        }
      }
    }, [visible]);

    useEffect(() => {
      sdk.WorkItem.load({
        spaceId: spaceId,
        workObjectId: workObjectId,
        workItemId: workItemId,
      }).then(async (workItem) => {
        const record = await workItem.getFieldValue(fieldKey);
        setDoc({ doc: record?.doc, is_empty: false });
      });
    }, [fieldKey, spaceId, workObjectId, workItemId, data]);

    useEffect(() => {
      let timer: any;
      if (visible && doc) {
        timer = setTimeout(() => {
          if (editorRef.current?.setValue) {
            editorRef.current.setValue(doc);
          }
        }, 200);
      }
      return () => {
        if (timer) {
          clearTimeout(timer);
        }
      };
    }, [visible, doc]);

    return (
      <div>
        <RichTextEditor
          editType="popover"
          editPopoverProps={{
            ref: editorRef,
            position: "bottomLeft",
            onSubmit: (result) => {
              setDoc(result);
              onChange(result);
            },
            children: (
              <div
                style={{
                  border: "1px solid var(--semi-color-border)",
                  borderRadius: "var(--semi-border-radius-small)",
                  height: 62,
                  cursor: "pointer",
                  padding: "0 12px",
                }}
                onClick={() => {
                  setVisible(true);
                }}
              >
                {doc ? (
                  <RichTextEditor
                    spaceId={spaceId}
                    editable={false}
                    defaultValue={doc}
                  />
                ) : (
                  data
                )}
              </div>
            ),
          }}
          spaceId={spaceId}
        />
      </div>
    );
  }
);
export default RichTextEditorCom;
