import request from "../../../api/request";
import { ResponseWrap, FlowNode2 } from "../../../api";
import { AxiosError } from "axios";

type RequestParams = Record<string, any>;

type RequestItem = {
  work_item_id: number;
  params: RequestParams;
};

export type RequestResult<T = any> = {
  work_item_id: number;
  params: RequestParams;
  data?: T;
  time?: string;
  err_msg?: string;
};

type RequestExecutor = (
  work_item_id: number,
  params: RequestParams,
  signal: AbortSignal
) => Promise<{ data: any; time: string }>;

/**
 * 分批并发请求控制器（严格按批次执行）
 * @param requests 包含work_item_id和参数的请求数组
 * @param batchSize 每批请求数量（并发数）
 * @param executor 自定义请求执行函数
 */
export async function batchConcurrentRequestController<T = any>(
  requests: RequestItem[],
  batchSize: number,
  executor: RequestExecutor
) {
  const totalRequests = requests.length;
  const allResults: RequestResult<T>[] = [];
  const abortControllers: Map<number, AbortController> = new Map();
  let isCanceled = false;
  let cancelReason = "";

  // 为所有请求创建控制器
  requests.forEach((request) => {
    const { work_item_id } = request;
    abortControllers.set(work_item_id, new AbortController());
  });

  // 取消所有请求的方法
  const abortAll = (reason = "User canceled") => {
    isCanceled = true;
    cancelReason = reason;
    abortControllers.forEach((controller) => {
      if (!controller.signal.aborted) {
        controller.abort(reason);
      }
    });
  };

  // 取消单个请求
  const abortById = (work_item_id: number, reason = "Canceled by id") => {
    const controller = abortControllers.get(work_item_id);
    if (controller && !controller.signal.aborted) {
      controller.abort(reason);
      return true;
    }
    return false;
  };

  try {
    // 计算总批次
    const totalBatches = Math.ceil(totalRequests / batchSize);
    // 按批次处理请求
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      // 如果已取消，停止处理后续批次
      if (isCanceled) break;
      // 计算当前批次的请求范围
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, totalRequests);
      const currentBatch = requests.slice(startIndex, endIndex);
      // 处理当前批次的所有请求
      const batchPromises = currentBatch.map((request) => {
        const { work_item_id, params } = request;
        const controller = abortControllers.get(work_item_id);

        if (!controller) {
          return Promise.resolve({
            work_item_id,
            params,
            err_msg: "Controller not found",
          } as RequestResult<T>);
        }
        // 检查是否已取消
        if (controller.signal.aborted) {
          return Promise.resolve({
            work_item_id,
            params,
            err_msg: "Request aborted before execution",
          } as RequestResult<T>);
        }

        // 执行请求
        return executor(work_item_id, params, controller.signal)
          .then(
            (result) =>
              ({
                work_item_id,
                params,
                ...result,
              } as RequestResult<T>)
          )
          .catch((error: any) => {
            const error_msg =
              error instanceof AxiosError
                ? `${error?.response?.data?.err?.msg}；logID: ${error?.response?.data?.err?.log_id}`
                : error instanceof Error
                ? error.message
                : String(error);
            return {
              work_item_id,
              params,
              err_msg: error_msg,
            } as RequestResult<T>;
          });
      });

      // 等待当前批次所有请求完成后再执行下一批
      const batchResults = await Promise.all(batchPromises);
      allResults.push(...batchResults);
      //   console.log(`第${batchIndex + 1}批执行完成`);
    }

    return {
      allResults,
      isCanceled: false,
      abortAll,
      abortById,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    abortAll(`Request processing failed: ${errorMessage}`);
    return {
      allResults,
      isCanceled: true,
      err_msg: errorMessage,
      abortAll,
      abortById,
    };
  }
}

export const customExecutor: RequestExecutor = async (
  work_item_id,
  params,
  signal
) => {
  const response = await request.post<unknown, ResponseWrap<FlowNode2[]>>(
    // "/m-api/v1/builtin_app/common_api/node_operation?app_type=batch_confirm_node",
    `/open_api/${params.projectKey}/workflow/${params.workItemKey}/${params.workItemId}/node/${params.nodeId}/operate`,
    {
      project_key: params.projectKey,
      work_item_type_key: params.workItemKey,
      work_item_id: params.workItemId,
      node_id: params.nodeId,
      action: "confirm",
      fields: params.fields,
    },
    {
      signal: signal, // 放置 signal 的位置
    }
  );
  if (response.code !== 0) {
    const error = `${
      response.msg || response.error?.localizedMessage.message
    }；logID: ${response?.logId}`;
    throw new Error(error);
  }

  return {
    data: response.data,
    time: new Date().toISOString(),
  };
};

export const groupByFieldKey2 = (a: any[], selectedNodeId) => {
  // 初始化分组结果和用于跟踪分组特征的数组
  const groups = {};
  const groupSignatures: string[] = [];
  let currentIndex = 0;

  // 遍历数组a
  a.forEach((item) => {
    // 获取当前项的field信息（假设每个item只有一个field）
    const field = item.fields[0];
    const signature: string = `${field.field_key}-${field.field_alias}`;

    // 检查是否已有相同特征的分组
    const existingIndex = groupSignatures.indexOf(signature);
    const currentStateKeys = item.workflow_infos.workflow_nodes?.filter(
      (i) => i.status === 2
    );
    let checkIsJoin = true;
    if (selectedNodeId) {
      checkIsJoin =
        currentStateKeys.filter((i) => i.state_key === selectedNodeId).length >
        0;
    }

    if (existingIndex !== -1) {
      // 如果已有相同特征的分组，加入到该分组
      if (checkIsJoin) {
        groups[existingIndex].push(item);
      }
    } else {
      // 如果没有，创建新分组
      groupSignatures.push(signature);
      if (checkIsJoin) {
        groups[currentIndex] = [item];
      } else {
        groups[currentIndex] = [];
      }
      currentIndex++;
    }
  });
  return groups;
};

export const groupByFieldKey = (a: any[], selectedNodeId) => {
  // 初始化分组结果数组和用于跟踪分组特征的映射
  const groups: any[] = [];
  const signatureToIndex = new Map();

  // 遍历数组a
  a.forEach((item) => {
    // 获取当前项的field信息（假设每个item只有一个field）
    const field = item.fields[0];
    const signature = `${field.field_key}-${field.field_alias}`;

    const currentStateKeys = item.workflow_infos.workflow_nodes?.filter(
      (i) => i.status === 2
    );
    let checkIsJoin = true;
    if (selectedNodeId) {
      checkIsJoin =
        currentStateKeys.filter((i) => i.state_key === selectedNodeId).length >
        0;
    }
    // 检查是否已有相同特征的分组
    if (signatureToIndex.has(signature)) {
      // 如果已有相同特征的分组，加入到该分组的children中
      const groupIndex = signatureToIndex.get(signature);
      if (checkIsJoin) {
        groups[groupIndex].children.push(item);
      }
    } else {
      // 如果没有，创建新分组
      const newGroupIndex = groups.length;
      if (checkIsJoin) {
        signatureToIndex.set(signature, newGroupIndex);
        groups.push({
          id: newGroupIndex,
          children: [item],
        });
      } else {
        groups.push({
          id: newGroupIndex,
          children: [],
        });
      }
    }
  });
  return groups;
};
